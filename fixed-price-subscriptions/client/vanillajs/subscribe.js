document.addEventListener('DOMContentLoaded', async () => {
  // Fetch public key and initialize Stripe.
  const {publishableKey} = await fetch('/config').then(r => r.json())
  const stripe = Stripe(publishableKey);

  // Create an elements group and a payment element.
  const clientSecret = window.sessionStorage.getItem('clientSecret');

  const elements = stripe.elements({
    clientSecret,
    fonts: [{
      cssSrc: 'https://fonts.googleapis.com/css?family=Raleway'
    }],
    appearance: {
      variables: {
        fontFamily: 'Raleway',
        colorText:  'rgba(0, 0, 0, 0.7)',
        colorTextSecondary:  'rgba(0, 0, 0, 0.7)'
      }
    }
  });

  const paymentElement = elements.create('payment');
  paymentElement.mount('#payment-element');

  // This sample only supports a Subscription with payment
  // upfront. If you offer a trial on your subscription, then
  // instead of confirming the subscription's latest_invoice's
  // payment_intent. You'll use stripe.confirmSetup to confirm
  // the subscription's pending_setup_intent.
  // See https://stripe.com/docs/billing/subscriptions/trials

  // Payment info collection and confirmation
  // When the submit button is pressed, attempt to confirm the payment intent
  // with the information input into the card element form.
  // - handle payment errors by displaying an alert. The customer can update
  //   the payment information and try again
  // - Stripe Elements automatically handles next actions like 3DSecure that are required for SCA
  // - Complete the subscription flow when the payment succeeds
  const form = document.querySelector('#subscribe-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Construct a url where the customer will be redirected
    // after they subscribe.
    const returnUrl = new URL(window.location.href);
    returnUrl.pathname = "/account.html";

    const {error} = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl.toString(),
      }
    })

    if(error) {
      setMessage(`Attempt to subscribe failed: ${error.message}`);
    } else {
      // Redirect the customer to their account page
      setMessage('Success! Redirecting to your account.');
      window.location.href = '/account.html';
    }
  });

  // Helper method for displaying debug messages.
  const setMessage = (message) => {
    const messageDiv = document.querySelector('#messages');
    messageDiv.innerHTML += "<br>" + message;
  }
});
