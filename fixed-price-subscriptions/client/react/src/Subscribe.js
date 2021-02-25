import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { withRouter } from 'react-router-dom';
import {
  CardElement,
  Elements,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Redirect } from 'react-router-dom';

const SubscribeForm = ({location}) => {
  // Get the lookup key for the price from the previous page redirect.
  const [priceLookupKey] = useState(location.state.priceLookupKey);
  const [name, setName] = useState('Jenny Rosen');
  const [messages, _setMessages] = useState('');
  const [subscription, setSubscription] = useState();

  // helper for displaying status messages.
  const setMessage = (message) => {
    _setMessages(`${messages}\n\n${message}`);
  }

  // Initialize an instance of stripe.
  const stripe = useStripe();
  const elements = useElements();

  if (!stripe || !elements) {
    // Stripe.js has not loaded yet. Make sure to disable
    // form submission until Stripe.js has loaded.
    return '';
  }

  // When the subscribe-form is submitted we do a few things:
  //
  //   1. Tokenize the payment method
  //   2. Create the subscription
  //   3. Handle any next actions like 3D Secure that are required for SCA.
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Get a reference to a mounted CardElement. Elements knows how
    // to find your CardElement because there can only ever be one of
    // each type of element.
    const cardElement = elements.getElement(CardElement);

    // Use card Element to tokenize payment details
    let { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: {
        name: name,
      }
    });

    if(error) {
      // show error and collect new card details.
      setMessage(error.message);
      return;
    }

    setMessage(`Payment method created ${paymentMethod.id}`);

    // Create the subscription.
    let {subError, subscription} = await fetch('/create-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceLookupKey,
        paymentMethodId: paymentMethod.id
      }),
    }).then(r => r.json());

    if(subError) {
      // show error and collect new card details.
      setMessage(subError.message);
      return;
    }

    setMessage(`Subscription created with status: ${subscription.status}`);
    setSubscription(subscription);

    // This sample only supports a Subscription with payment
    // upfront. If you offer a trial on your subscription, then
    // instead of confirming the subscription's latest_invoice's
    // payment_intent. You'll use stripe.confirmCardSetup to confirm
    // the subscription's pending_setup_intent.
    switch(subscription.status) {
      case 'active':
        // Redirect to account page
        setMessage("Success! Redirecting to your account.");
        break;


      case 'incomplete':
        setMessage("Please confirm the payment.");

        // Handle next actions
        //
        // If the status of the subscription is `incomplete` that means
        // there are some further actions required by the customer. In
        // the case of upfront payment (not trial) the payment is confirmed
        // by passing the client_secret of the subscription's latest_invoice's
        // payment_intent.
        //
        // For trials, this works a little differently and requires a call to
        // `stripe.confirmCardSetup` and passing the subscription's
        // pending_setup_intent's client_secret like so:
        //
        //   const {error, setupIntent} = await stripe.confirmCardSetup(
        //     subscription.pending_setup_intent.client_secret
        //   )
        //
        // then handling the resulting error and setupIntent as we do below.
        //
        // This sample does not support subscriptions with trials. Instead, use these docs:
        // https://stripe.com/docs/billing/subscriptions/trials
        const {error} = await stripe.confirmCardPayment(
          subscription.latest_invoice.payment_intent.client_secret,
        )

        if(error) {
          setMessage(error.message);
        } else {
          setMessage("Success! Redirecting to your account.");
          setSubscription({ status: 'active' });
        }
        break;


      default:
        setMessage(`Unknown Subscription status: ${subscription.status}`);
    }
  }

  if(subscription && subscription.status === 'active') {
    return <Redirect to={{pathname: '/account'}} />
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Full name
        <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <CardElement />

      <button type="submit">
        Subscribe
      </button>

      <div>{messages}</div>
    </form>
  )
}

const Subscribe = (props) => {
  let stripePromise = null;
  const [publishableKey, setPublishableKey] = useState(null);

  if(publishableKey) {
    stripePromise = loadStripe(publishableKey);
  } else {
    fetch("/config").then(r => r.json()).then(({publishableKey}) => {
      setPublishableKey(publishableKey);
    });
  }

  return (
    <Elements stripe={stripePromise}>
      <h1>Subscribe</h1>

      <p>
        Try the successful test card: <span>4242424242424242</span>.
      </p>

      <p>
        Try the test card that requires SCA: <span>4000002500003155</span>.
      </p>

      <p>
        Use any <i>future</i> expiry date, CVC,5 digit postal code
      </p>

      <hr />

      <SubscribeForm {...props} />
    </Elements>
  );
}

export default withRouter(Subscribe);
