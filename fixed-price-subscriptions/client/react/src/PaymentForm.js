import React, { useState } from 'react';
import './App.css';
import { loadStripe } from '@stripe/stripe-js';
import {
  CardElement,
  Elements,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Redirect } from 'react-router-dom';

// Make sure to call `loadStripe` outside of a component’s render to avoid
// recreating the `Stripe` object on every render.
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
if (!process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY) {
  console.error('**Stripe publishable key environment variable not set**');
  console.error(
    '**Add an environemnt variable REACT_APP_STRIPE_PUBLISHABLE_KEY**'
  );
  console.error('**Replace .env.example with .env and **');
}

const CheckoutForm = ({ productSelected, customer }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [subscribing, setSubscribing] = useState(false);
  const [accountInformation, setAccountInformation] = useState(null);
  const [errorToDisplay, setErrorToDisplay] = useState('');

  function handlePaymentThatRequiresCustomerAction({
    subscription,
    invoice,
    priceId,
    paymentMethodId,
    isRetry,
  }) {
    if (subscription && subscription.status === 'active') {
      // subscription is active, no customer actions required.
      return { subscription, priceId, paymentMethodId };
    }

    // If it's a first payment attempt, the payment intent is on the subscription latest invoice.
    // If it's a retry, the payment intent will be on the invoice itself.
    const paymentIntent = invoice
      ? invoice.payment_intent
      : subscription.latest_invoice.payment_intent;

    if (
      paymentIntent.status === 'requires_action' ||
      (isRetry === true && paymentIntent.status === 'requires_payment_method')
    ) {
      return stripe
        .confirmCardPayment(paymentIntent.client_secret, {
          payment_method: paymentMethodId,
        })
        .then((result) => {
          if (result.error) {
            // start code flow to handle updating the payment details
            // Display error message in your UI.
            // The card was declined (i.e. insufficient funds, card has expired, etc)
            throw result;
          } else {
            if (result.paymentIntent.status === 'succeeded') {
              // There's a risk of the customer closing the window before callback
              // execution. To handle this case, set up a webhook endpoint and
              // listen to invoice.payment_succeeded. This webhook endpoint
              // returns an Invoice.
              return {
                priceId: priceId,
                subscription: subscription,
                invoice: invoice,
                paymentMethodId: paymentMethodId,
              };
            }
          }
        });
    } else {
      // No customer action needed
      return { subscription, priceId, paymentMethodId };
    }
  }

  function handleRequiresPaymentMethod({
    subscription,
    paymentMethodId,
    priceId,
  }) {
    if (subscription.status === 'active') {
      // subscription is active, no customer actions required.
      return { subscription, priceId, paymentMethodId };
    } else if (
      subscription.latest_invoice.payment_intent.status ===
      'requires_payment_method'
    ) {
      // Using localStorage to store the state of the retry here
      // (feel free to replace with what you prefer)
      // Store the latest invoice ID and status
      localStorage.setItem('latestInvoiceId', subscription.latest_invoice.id);
      localStorage.setItem(
        'latestInvoicePaymentIntentStatus',
        subscription.latest_invoice.payment_intent.status
      );
      throw new Error('Your card was declined.');
    } else {
      return { subscription, priceId, paymentMethodId };
    }
  }

  function retryInvoiceWithNewPaymentMethod({ paymentMethodId, invoiceId }) {
    const priceId = productSelected.name.toUpperCase();
    return (
      fetch('/retry-invoice', {
        method: 'post',
        headers: {
          'Content-type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customer.id,
          paymentMethodId: paymentMethodId,
          invoiceId: invoiceId,
        }),
      })
        .then((response) => {
          return response.json();
        })
        // If the card is declined, display an error to the user.
        .then((result) => {
          if (result.error) {
            // The card had an error when trying to attach it to a customer.
            throw result;
          }
          return result;
        })
        // Normalize the result to contain the object returned by Stripe.
        // Add the addional details we need.
        .then((result) => {
          return {
            // Use the Stripe 'object' property on the
            // returned result to understand what object is returned.
            invoice: result,
            paymentMethodId: paymentMethodId,
            priceId: priceId,
            isRetry: true,
          };
        })
        // Some payment methods require a customer to be on session
        // to complete the payment process. Check the status of the
        // payment intent to handle these actions.
        .then(handlePaymentThatRequiresCustomerAction)
        // No more actions required. Provision your service for the user.
        .then(onSubscriptionComplete)
        .catch((error) => {
          console.log(error);
          // An error has happened. Display the failure to the user here.
          setSubscribing(false);
          setErrorToDisplay(error && error.error && error.error.decline_code);
        })
    );
  }

  function onSubscriptionComplete(result) {
    console.log(result);
    // Payment was successful. Provision access to your service.
    // Remove invoice from localstorage because payment is now complete.
    // clearCache();
    if (result && !result.subscription) {
      const subscription = { id: result.invoice.subscription };
      result.subscription = subscription;
      localStorage.clear();
    }

    setAccountInformation(result);
    // Change your UI to show a success message to your customer.
    // onSubscriptionSampleDemoComplete(result);
    // Call your backend to grant access to your service based on
    // the product your customer subscribed to.
    // Get the product by using result.subscription.price.product
  }

  function createSubscription({ paymentMethodId }) {
    const priceId = productSelected.name.toUpperCase();
    return (
      fetch('/create-subscription', {
        method: 'post',
        headers: {
          'Content-type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customer.id,
          paymentMethodId: paymentMethodId,
          priceId: priceId,
        }),
      })
        .then((response) => {
          return response.json();
        })
        // If the card is declined, display an error to the user.
        .then((result) => {
          if (result.error) {
            // The card had an error when trying to attach it to a customer
            throw result;
          }
          return result;
        })
        // Normalize the result to contain the object returned
        // by Stripe. Add the addional details we need.
        .then((result) => {
          return {
            // Use the Stripe 'object' property on the
            // returned result to understand what object is returned.
            subscription: result,
            paymentMethodId: paymentMethodId,
            priceId: productSelected.name,
          };
        })
        // Some payment methods require a customer to do additional
        // authentication with their financial institution.
        // Eg: 2FA for cards.
        .then(handlePaymentThatRequiresCustomerAction)
        // If attaching this card to a Customer object succeeds,
        // but attempts to charge the customer fail. You will
        // get a requires_payment_method error.
        .then(handleRequiresPaymentMethod)
        // No more actions required. Provision your service for the user.
        .then(onSubscriptionComplete)
        .catch((error) => {
          // An error has happened. Display the failure to the user here.
          // We utilize the HTML element we created.
          setSubscribing(false);
          setErrorToDisplay(error.message || error.error.decline_code);
        })
    );
  }

  const handleSubmit = async (event) => {
    // Block native form submission.
    event.preventDefault();

    setSubscribing(true);

    if (!stripe || !elements) {
      // Stripe.js has not loaded yet. Make sure to disable
      // form submission until Stripe.js has loaded.
      return;
    }

    // Get a reference to a mounted CardElement. Elements knows how
    // to find your CardElement because there can only ever be one of
    // each type of element.
    const cardElement = elements.getElement(CardElement);

    // If a previous payment was attempted, get the lastest invoice
    const latestInvoicePaymentIntentStatus = localStorage.getItem(
      'latestInvoicePaymentIntentStatus'
    );

    // Use your card Element with other Stripe.js APIs
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (error) {
      console.log('[createPaymentMethod error]', error);
      setSubscribing(false);
      setErrorToDisplay(error && error.message);
      return;
    }
    console.log('[PaymentMethod]', paymentMethod);
    const paymentMethodId = paymentMethod.id;
    if (latestInvoicePaymentIntentStatus === 'requires_payment_method') {
      // Update the payment method and retry invoice payment
      const invoiceId = localStorage.getItem('latestInvoiceId');
      retryInvoiceWithNewPaymentMethod({
        paymentMethodId: paymentMethodId,
        invoiceId: invoiceId,
      });
      return;
    }

    // Create the subscription
    createSubscription({
      paymentMethodId: paymentMethodId,
    });

    
  };

  if (accountInformation) {
    return (
      <Redirect
        to={{
          pathname: '/account',
          state: { accountInformation: accountInformation },
        }}
      />
    );
  } else {
    return (
      <div id="payment-form" className="flex justify-center">
        <div className="w-full inline-block border p-4 rounded-md">
          <div className="font-bold text-xl mb-2">
            Enter your card details. <br />
            Your subscription will start now.
          </div>
          <p className="text-gray-700 text-base">
            → Total due now <span>{productSelected.price}</span>
          </p>
          <p className="text-gray-700 text-base mb-4">
            → Subscribing to{' '}
            <span className="font-bold">{productSelected.name}</span>
          </p>

          <div className="w-full">
            <div className="flex flex-wrap -mx-3 mb-2">
              <div className="w-full px-3 md:mb-0">
                <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2">
                  Full name
                </label>
                <input
                  className="appearance-none block w-full bg-gray-200 border rounded-md py-3 px-2 mb-3 leading-tight focus:outline-none focus:bg-white"
                  id="name"
                  type="text"
                  placeholder="First and last name"
                  required
                />
              </div>
            </div>
            <form id="payment-form" onSubmit={handleSubmit}>
              <div className="flex flex-wrap -mx-3 mb-3">
                <div className="w-full px-3 mb-0">
                  <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2">
                    Card
                  </label>
                  <div
                    className="appearance-none block w-full bg-gray-200 text-gray-700 border rounded-md py-3 px-2 leading-tight focus:outline-none focus:bg-white"
                    id="card-element"
                  >
                    <CardElement
                      options={{
                        style: {
                          base: {
                            fontSize: '16px',
                            color: '#32325d',
                            fontFamily:
                              '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
                            '::placeholder': {
                              color: '#a0aec0',
                            },
                          },
                          invalid: {
                            color: '#9e2146',
                          },
                        },
                      }}
                    />
                  </div>
                  <div className="text-gray-700 text-base mt-2" role="alert">
                    {errorToDisplay ? errorToDisplay : null}
                  </div>
                </div>
              </div>
              <button
                id="submit-premium"
                className="w-full bg-pasha hover:bg-white hover:shadow-outline hover:text-pasha hover:border hover:border-black focus:shadow-outline text-white focus:bg-white focus:text-pasha font-light py-2 px-4 rounded-md"
                type="submit"
              >
                <div className="">
                  <div>{subscribing ? 'Subscribing...' : 'Subscribe'}</div>
                </div>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }
};

const PaymentForm = (props) => (
  <Elements stripe={stripePromise}>
    <CheckoutForm {...props} />
  </Elements>
);

export default PaymentForm;
