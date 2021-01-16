// Extract the price query string argument. This is one of `basic` or
// `premium` and we'll need to pass this to the server when we create the
// Subscription.
const params = new URLSearchParams(window.location.search);
const priceLookupKey = params.get('price');

// Initialize an instance of Stripe
const stripe = Stripe("pk_test_vAZ3gh1LcuM7fW4rKNvqafgB00DR9RKOjN")

// Create and mount the single line card element
const elements = stripe.elements();
const cardElement = elements.create('card');
cardElement.mount('#card-element');

// Create a payment method
const form = document.querySelector('#subscribe-form');
form.addEventListener('submit', async (e) => {
  // Don't fully submit the form.
  e.preventDefault();

  setMessage("Subscribing... please wait.");

  // This makes a client side API call to Stripe to
  // tokenize the payment details and returns either
  // an error or a new paymentMethod object that we'll
  // pass when creating the Subscription.
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

    // Create subscription.
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
        // Handle SCA
        setMessage("Please confirm the payment.");

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

const setMessage = (message) => {
  const errorDiv = document.querySelector('#messages');
  errorDiv.innerHTML += "<br>" + message;
}
