document.addEventListener('DOMContentLoaded', async () => {
  // Extract the price query string argument. This is one of `basic` or
  // `premium` and we'll need to pass this to the server when we create the
  // Subscription. The server will use this "lookup key" to find
  // the ID of the Stripe price object. The sample uses environment variables
  // however you could also use the lookup_keys filter on the Price list
  // API to filter prices by lookup key.
  const params = new URLSearchParams(window.location.search);
  const priceLookupKey = params.get('price');

  // Initialize an instance of Stripe
  const {publishableKey} = await fetch("/config").then(r => r.json());
  const stripe = Stripe(publishableKey);

  // Create and mount the single line card element
  const elements = stripe.elements();
  const cardElement = elements.create('card');
  cardElement.mount('#card-element');

  // When the subscribe-form is submitted we do a few things.
  //
  // 1. Tokenize the payment method
  // 2. Create the subscription
  // 3. Handle any next actions like 3DSecure that are required for SCA.
  const form = document.querySelector('#subscribe-form');
  form.addEventListener('submit', async (e) => {
    // Don't fully submit the form.
    e.preventDefault();

    setMessage("Subscribing... please wait.");

    // Tokenize the payment method.
    //
    // This makes a client side API call to Stripe to pass the payment
    // details and returns either an error or a new paymentMethod object that
    // we'll pass when creating the Subscription.
    const nameInput = document.querySelector('#name');
    const {error, paymentMethod} = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: {
        name: nameInput.value,
      }
    });

    if(error) {
      // show error and collect new card details.
      setMessage(error.message);
    } else {
      setMessage(`Payment method created ${paymentMethod.id}`);

      // Create the subscription.
      const {error, subscription} = await fetch('/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceLookupKey,
          paymentMethodId: paymentMethod.id
        }),
      })
        .then((response) => response.json());

      if(error) {
        // show error and collect new card details.
        setMessage(error.message);
        return;
      }

      setMessage(`Subscription created with status: ${subscription.status}`);

      // This sample only supports a Subscription with payment
      // upfront. If you offer a trial on your subscription, then
      // instead of confirming the subscription's latest_invoice's
      // payment_intent. You'll use stripe.confirmCardSetup to confirm
      // the subscription's pending_setup_intent.
      switch(subscription.status) {
        case 'active':
          // Redirect to account page
          setMessage("Success! Redirecting to your account.");
          window.location.href = 'account.html';
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
          const {error, paymentIntent} = await stripe.confirmCardPayment(
            subscription.latest_invoice.payment_intent.client_secret,
          )

          if(error) {
            setMessage(error.message);
          } else {
            setMessage("Success! Redirecting to your account.");
            window.location.href = 'account.html';
          }
          break;


        default:
          setMessage(`Unknown Subscription status: ${subscription.status}`);
      }
    }
  });
});

// helper method for displaying a status message.
const setMessage = (message) => {
  const messageDiv = document.querySelector('#messages');
  messageDiv.innerHTML += "<br>" + message;
}
