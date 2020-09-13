let stripe, customer, price, card;

let priceInfo = {
  basic: {
    amount: '500',
    name: 'Basic',
    interval: 'monthly',
    currency: 'USD',
  },
  premium: {
    amount: '1500',
    name: 'Premium',
    interval: 'monthly',
    currency: 'USD',
  },
};

var accountInfo = {};

function stripeElements(publishableKey) {
  stripe = Stripe(publishableKey);

  if (document.getElementById('card-element')) {
    let elements = stripe.elements();

    // Card Element styles
    let style = {
      base: {
        fontSize: '16px',
        color: '#32325d',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
        fontSmoothing: 'antialiased',
        '::placeholder': {
          color: '#a0aec0',
        },
      },
    };

    card = elements.create('card', { style: style });

    card.mount('#card-element');

    card.on('focus', function () {
      let el = document.getElementById('card-element-errors');
      el.classList.add('focused');
    });

    card.on('blur', function () {
      let el = document.getElementById('card-element-errors');
      el.classList.remove('focused');
    });

    card.on('change', function (event) {
      displayError(event);
    });
  }

  let signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', function (evt) {
      evt.preventDefault();
      changeLoadingState(true);
      // Create customer
      createCustomer().then((result) => {
        customer = result.customer;

        window.location.href = '/prices.html?customerId=' + customer.id;
      });
    });
  }

  let paymentForm = document.getElementById('payment-form');
  if (paymentForm) {
    paymentForm.addEventListener('submit', function (evt) {
      evt.preventDefault();
      changeLoadingStateprices(true);

      // If a previous payment was attempted, get the lastest invoice
      const latestInvoicePaymentIntentStatus = localStorage.getItem(
        'latestInvoicePaymentIntentStatus'
      );

      if (latestInvoicePaymentIntentStatus === 'requires_payment_method') {
        const invoiceId = localStorage.getItem('latestInvoiceId');
        const isPaymentRetry = true;
        // create new payment method & retry payment on invoice with new payment method
        createPaymentMethod({
          card,
          isPaymentRetry,
          invoiceId,
        });
      } else {
        // create new payment method & create subscription
        createPaymentMethod({ card });
      }
    });
  }
}

function displayError(event) {
  changeLoadingStateprices(false);
  let displayError = document.getElementById('card-element-errors');
  if (event.error) {
    displayError.textContent = event.error.message;
  } else {
    displayError.textContent = '';
  }
}

function createPaymentMethod({ card, isPaymentRetry, invoiceId }) {
  const params = new URLSearchParams(document.location.search.substring(1));
  const customerId = params.get('customerId');
  // Set up payment method for recurring usage
  let billingName = document.querySelector('#name').value;

  let priceId = document.getElementById('priceId').innerHTML.toUpperCase();

  let quantity = parseInt(
    document.getElementById('subscription-quantity').innerText
  );

  stripe
    .createPaymentMethod({
      type: 'card',
      card: card,
      billing_details: {
        name: billingName,
      },
    })
    .then((result) => {
      if (result.error) {
        displayError(result);
      } else {
        if (isPaymentRetry) {
          // Update the payment method and retry invoice payment
          retryInvoiceWithNewPaymentMethod(
            customerId,
            result.paymentMethod.id,
            invoiceId,
            priceId
          );
        } else {
          // Create the subscription
          createSubscription(
            customerId,
            result.paymentMethod.id,
            priceId,
            quantity
          );
        }
      }
    });
}

function goToPaymentPage(evt) {
  button = evt.currentTarget;

  const params = new URLSearchParams(document.location.search.substring(1));
  const customerId = params.get('customerId');

  priceId = button.dataset.plan;

  quantity = parseInt(document.getElementById('quantity-input-' + priceId).value);

  retrieveUpcomingInvoice(customerId, null, priceId, quantity).then(
    (response) => {
      invoice = response.invoice;
      document.getElementById('total-due-now').innerText = getFormattedAmount(
        invoice.total
      );

      // Add the price selected, hidden spans but we might move them to a js hash depending on how we change pulling price info
      //FIXME: are we still using either of these?
      document.getElementById('priceId').innerHTML = priceInfo[priceId].name;
      document.getElementById('subscription-quantity').innerText = quantity;

      description = '';
      invoice.lines.data.forEach((line) => {
        description += `${line.description}: ${getFormattedAmount(
          line.amount
        )} <br/>`;
      });
      document.getElementById('description').innerHTML = description;

      // Show which price the user selected
      if (priceId === 'premium') {
        document.querySelector('#submit-premium-button-text').innerText =
          'Selected';
        document.querySelector('#submit-basic-button-text').innerText =
          'Select';
      } else {
        document.querySelector('#submit-premium-button-text').innerText =
          'Select';
        document.querySelector('#submit-basic-button-text').innerText =
          'Selected';
      }
    }
  );
  // Update the border to show which price is selected
  changePriceSelection(priceId);

  // Show the payment screen
  document.querySelector('#payment-form').classList.remove('hidden');
}

function changePrice() {
  demoChangePrice();
}

// newPriceIdSelected is currently a name like 'BASIC' and 'PREMIUM'
function switchPrices(newPriceIdSelected) {
  const params = new URLSearchParams(document.location.search.substring(1));
  const currentSubscribedpriceId = accountInfo.priceId;
  const customerId = accountInfo.customerId;
  const subscriptionId = accountInfo.subscriptionId;
  const currentQuantity = accountInfo.quantity;

  newQuantity = document.getElementById(
    'quantity-input-' + newPriceIdSelected.toLowerCase()
  ).value;

  //update account info to store the new quantity and/or new price to be submitted
  accountInfo.newQuantity = newQuantity;
  accountInfo.newPriceId = newPriceIdSelected;

  // Update the border to show which price is selected
  changePriceSelection(newPriceIdSelected);

  changeLoadingStateprices(true);

  // Retrieve the upcoming invoice to display details about
  // the price change
  retrieveUpcomingInvoice(
    customerId,
    subscriptionId,
    newPriceIdSelected,
    newQuantity
  ).then((response) => {
    upcomingInvoice = response.invoice;
    immediateTotal = response.immediate_total;
    nextInvoiceTotal = response.next_invoice_sum;

    var changeSummaryDiv = document.getElementById('change-summary');

    var description = '';

    if (parseInt(newQuantity) >= currentQuantity) {
      description += `You added <b> ${
        newQuantity - currentQuantity
      }</b> additional seat(s),`;
    } else {
      description += `You removed <b> ${
        currentQuantity - newQuantity
      }</b> seat(s)`;
    }

    description += ` bringing you to a total of <b> ${newQuantity} </b> seat(s) on the <b>${newPriceIdSelected}</b> plan.<br/>`;
    document.getElementById('quantity-change').innerHTML = description;

    if (immediateTotal > 0) {
      document.getElementById(
        'immediate-total'
      ).innerHTML = `You will be charged <b> ${getFormattedAmount(
        immediateTotal
      )} </b> today.`;
      document.getElementById(
        'next-payment'
      ).innerHTML = `<br/> Your next payment of <b>${getFormattedAmount(
        nextInvoiceTotal
      )} </b> will be due <b>${getDateStringFromUnixTimestamp(
        upcomingInvoice.next_payment_attempt
      )} </b>`;
    } else {
      document.getElementById('immediate-total').innerHTML =
        `There's nothing due today. <br> You have a credit of <b>${getFormattedAmount(
          immediateTotal
        )}</b> that will be applied to ` +
        `your next invoice of <b>${getFormattedAmount(
          nextInvoiceTotal
        )} </b>, due on <b>${getDateStringFromUnixTimestamp(
          upcomingInvoice.next_payment_attempt
        )}.`;
    }

    //changeLoadingStateprices(false);
    document.querySelector('#price-change-form').classList.remove('hidden');
  });
}

function confirmPriceChange() {
  updateSubscription(
    accountInfo.newPriceId.toUpperCase(),
    accountInfo.subscriptionId,
    accountInfo.newQuantity
  ).then((result) => {
    let searchParams = new URLSearchParams(window.location.search);
    searchParams.set('priceId', accountInfo.newPriceId.toUpperCase());
    searchParams.set('priceHasChanged', true);
    window.location.search = searchParams.toString();
  });
}

function createCustomer() {
  let billingEmail = document.querySelector('#email').value;

  return fetch('/create-customer', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: billingEmail,
    }),
  })
    .then((response) => {
      return response.json();
    })
    .then((result) => {
      return result;
    });
}

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
  let paymentIntent = invoice
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
            // listen to invoice.paid. This webhook endpoint returns an Invoice.
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
    throw { error: { message: 'Your card was declined.' } };
  } else {
    return { subscription, priceId, paymentMethodId };
  }
}

function onSubscriptionComplete(result) {
  console.log(result);
  // Payment was successful. Provision access to your service.
  // Remove invoice from localstorage because payment is now complete.
  clearCache();
  // Change your UI to show a success message to your customer.
  onSubscriptionSampleDemoComplete(result);
  // Call your backend to grant access to your service based on
  // the product your customer subscribed to.
  // Get the product by using result.subscription.price.product
}

function createSubscription(customerId, paymentMethodId, priceId, quantity) {
  return (
    fetch('/create-subscription', {
      method: 'post',
      headers: {
        'Content-type': 'application/json',
      },
      body: JSON.stringify({
        customerId: customerId,
        paymentMethodId: paymentMethodId,
        priceId: priceId,
        quantity: quantity,
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
          priceId: priceId,
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
        displayError(error);
      })
  );
}

function retryInvoiceWithNewPaymentMethod(
  customerId,
  paymentMethodId,
  invoiceId,
  priceId
) {
  return (
    fetch('/retry-invoice', {
      method: 'post',
      headers: {
        'Content-type': 'application/json',
      },
      body: JSON.stringify({
        customerId: customerId,
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
        // An error has happened. Display the failure to the user here.
        // We utilize the HTML element we created.
        displayError(error);
      })
  );
}

function retrieveUpcomingInvoice(
  customerId,
  subscriptionId,
  newPriceId,
  quantity
) {
  return fetch('/retrieve-upcoming-invoice', {
    method: 'post',
    headers: {
      'Content-type': 'application/json',
    },
    body: JSON.stringify({
      customerId: customerId,
      subscriptionId: subscriptionId,
      newPriceId: newPriceId,
      quantity: quantity,
    }),
  })
    .then((response) => {
      return response.json();
    })
    .then((invoice) => {
      return invoice;
    });
}

function cancelSubscription() {
  changeLoadingStateprices(true);
  const params = new URLSearchParams(document.location.search.substring(1));
  const subscriptionId = params.get('subscriptionId');

  return fetch('/cancel-subscription', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscriptionId: subscriptionId,
    }),
  })
    .then((response) => {
      return response.json();
    })
    .then((cancelSubscriptionResponse) => {
      return subscriptionCancelled(cancelSubscriptionResponse);
    });
}

function updateSubscription(priceId, subscriptionId, quantity) {
  return fetch('/update-subscription', {
    method: 'post',
    headers: {
      'Content-type': 'application/json',
    },
    body: JSON.stringify({
      subscriptionId: subscriptionId,
      newPriceId: priceId,
      quantity: quantity,
    }),
  })
    .then((response) => {
      return response.json();
    })
    .then((response) => {
      return response;
    });
}

function getSubscriptionInformation(subscriptionId) {
  return fetch('/retrieve-subscription-information', {
    method: 'post',
    headers: {
      'Content-type': 'application/json',
    },
    body: JSON.stringify({
      subscriptionId: subscriptionId,
    }),
  })
    .then((response) => {
      return response.json();
    })
    .then((response) => {
      return response;
    });
}

function initPricingPage() {
  addQuantityListeners();
}

function getConfig() {
  return fetch('/config', {
    method: 'get',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then((response) => {
      return response.json();
    })
    .then((response) => {
      // Set up Stripe Elements
      stripeElements(response.publishableKey);
    });
}

getConfig();

/* ------ Sample helpers ------- */

function getFormattedAmount(amount) {
  // Format price details and detect zero decimal currencies
  var amount = amount;
  var numberFormat = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'symbol',
  });
  var parts = numberFormat.formatToParts(amount);
  var zeroDecimalCurrency = true;
  for (var part of parts) {
    if (part.type === 'decimal') {
      zeroDecimalCurrency = false;
    }
  }
  amount = zeroDecimalCurrency ? amount : amount / 100;
  var formattedAmount = numberFormat.format(amount);

  return formattedAmount;
}

function capitalizeFirstLetter(string) {
  let tempString = string.toLowerCase();
  return tempString.charAt(0).toUpperCase() + tempString.slice(1);
}

function getDateStringFromUnixTimestamp(date) {
  let nextPaymentAttemptDate = new Date(date * 1000);
  let day = nextPaymentAttemptDate.getDate();
  let month = nextPaymentAttemptDate.getMonth() + 1;
  let year = nextPaymentAttemptDate.getFullYear();

  return month + '/' + day + '/' + year;
}

// For demo purpose only
// Populates data on the account.html page.
function showSubscriptionInformation() {
  let params = new URLSearchParams(document.location.search.substring(1));

  let subscriptionId = params.get('subscriptionId');
  if (subscriptionId) {
    getSubscriptionInformation(subscriptionId).then(function (response) {
      latestInvoice = response.latest_invoice;
      upcomingInvoice = response.upcoming_invoice;
      productDescription = response.product_description;
      currentPrice = response.current_price;
      currentQuantity = response.current_quantity;

      document.getElementById(
        'subscription-details'
      ).innerHTML = `You are subscribed to <b>${currentQuantity}</b> seat(s) on the <b>${productDescription}</b> plan.<br/>`;

      description = `Your last payment was <b>${getFormattedAmount(
        latestInvoice.amount_paid
      )}</b>.`;
      if (latestInvoice.description) {
        description += `Details: ${latestInvoice.description}`;
      }

      document.getElementById('last-payment-summary').innerHTML = description;
      document.getElementById(
        'next-payment-summary'
      ).innerHTML = `Your next payment of <b>${getFormattedAmount(
        upcomingInvoice.amount_due
      )} </b> will be due <b>${getDateStringFromUnixTimestamp(
        upcomingInvoice.next_payment_attempt
      )} </b>`;

      document.getElementById('credit-card-last-four').innerText =
        capitalizeFirstLetter(response.card.brand) +
        ' •••• ' +
        response.card.last4;

      accountInfo.subscriptionId = subscriptionId;
      accountInfo.priceId = currentPrice;
      accountInfo.quantity = currentQuantity;
      accountInfo.customerId = latestInvoice.customer;
    });
  }
}

// Shows the cancellation response
function subscriptionCancelled() {
  document.querySelector('#subscription-cancelled').classList.remove('hidden');
  document.querySelector('#subscription-settings').classList.add('hidden');
}

/* Redirects the to the account page.  */
function onSubscriptionSampleDemoComplete({
  priceId: priceId,
  subscription: subscription,
  paymentMethodId: paymentMethodId,
  invoice: invoice,
}) {
  let subscriptionId;
  let currentPeriodEnd;
  let customerId;
  if (subscription) {
    subscriptionId = subscription.id;
  } else {
    subscriptionId = invoice.subscription;
  }

  window.location.href =
    '/account.html?subscriptionId=' + subscriptionId + '&priceId=' + priceId;
}

function initAccountPage() {
  showSubscriptionInformation();
  addQuantityListeners();
}

function demoChangePrice() {
  document.querySelector('#basic').classList.remove('border-pasha');
  document.querySelector('#premium').classList.remove('border-pasha');
  document.querySelector('#price-change-form').classList.add('hidden');

  // Grab the priceId from the URL
  // This is meant for the demo, replace with a cache or database.
  const params = new URLSearchParams(document.location.search.substring(1));
  const priceId = params.get('priceId').toLowerCase();

  document.querySelector('#prices-form').classList.remove('hidden');
  containerDiv = document.querySelector('#' + priceId.toLowerCase());
  containerDiv.classList.add('border-pasha');

  let elements = containerDiv.querySelectorAll(
    '#submit-' + priceId + '-button-text'
  );
  for (let i = 0; i < elements.length; i++) {
    elements[0].childNodes[3].innerText = 'Update Seats';
  }

  quantityInput = containerDiv.getElementsByClassName('quantity-input')[0];
  quantityInput.value = accountInfo.quantity;
}

// Changes the price selected
//FIXME: I'm not seeing any update occurring here, or even the style referenced.  Can we remove this?
function changePriceSelection(priceId) {
  document.querySelector('#basic').classList.remove('border-pasha');
  document.querySelector('#premium').classList.remove('border-pasha');
  document
    .querySelector('#' + priceId.toLowerCase())
    .classList.add('border-pasha');
}

// Show a spinner on subscription submission
function changeLoadingState(isLoading) {
  if (isLoading) {
    document.querySelector('#button-text').classList.add('hidden');
    document.querySelector('#loading').classList.remove('hidden');
    document.querySelector('#signup-form button').disabled = true;
  } else {
    document.querySelector('#button-text').classList.remove('hidden');
    document.querySelector('#loading').classList.add('hidden');
    document.querySelector('#signup-form button').disabled = false;
  }
}

// Show a spinner on subscription submission
function changeLoadingStateprices(isLoading) {
  if (isLoading) {
    //document.querySelector('#button-text').classList.add('hidden');
    //document.querySelector('#loading').classList.remove('hidden');
    //document.querySelector('#submit-basic').classList.add('invisible');
    //document.querySelector('#submit-premium').classList.add('invisible');
    /*if (document.getElementById('confirm-price-change-cancel')) {
      document
        .getElementById('confirm-price-change-cancel')
        .classList.add('invisible');
    }
    */
  } else {
    /*let buttons = document.querySelectorAll('#button-text');
    let loading = document.querySelectorAll('#loading');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].classList.remove('hidden');
      loading[i].classList.remove('loading');
    }
    document.querySelector('#submit-basic').classList.remove('invisible');
    document.querySelector('#submit-premium').classList.remove('invisible');
    if (document.getElementById('confirm-price-change-cancel')) {
      document
        .getElementById('confirm-price-change-cancel')
        .classList.remove('invisible');
      document
        .getElementById('confirm-price-change-submit')
        .classList.remove('invisible');
    }
    */
  }
}

function clearCache() {
  localStorage.clear();
}

function resetDemo() {
  clearCache();
  window.location.href = '/';
}

//Constants used for quantity setters
var MIN_SUBS = 1;
var MAX_SUBS = 100;

function updateQuantity(evt) {
  if (evt && evt.type === 'keypress' && evt.keyCode !== 13) {
    return;
  }

  button = evt.target;
  containingDiv = button.parentElement;
  var inputEl = containingDiv.getElementsByTagName('input')[0];
  var isAdding = button.classList.contains('increment-add');
  var currentQuantity = parseInt(inputEl.value);

  Array.from(containingDiv.getElementsByTagName('button')).forEach(
    (element) => {
      element.disabled = false;
    }
  );

  // Calculate new quantity

  var quantity = evt
    ? isAdding
      ? currentQuantity + 1
      : currentQuantity - 1
    : currentQuantity;
  // Update number input with new value.
  inputEl.value = quantity;

  // Disable the button if the customers hits the max or min
  if (quantity === MIN_SUBS) {
    containingDiv.getElementsByClassName(
      'increment-subtract'
    )[0].disabled = true;
  }
  if (quantity === MAX_SUBS) {
    containingDiv.getElementsByClassName('increment-add')[0].disabled = true;
  }
}

function addQuantityListeners() {
  Array.from(document.getElementsByClassName('quantity-input')).forEach(
    (element) => {
      element.addEventListener('change', function (evt) {
        // Ensure customers only buy between 1 and 10 photos
        if (evt.target.value < MIN_SUBS) {
          evt.target.value = MIN_SUBS;
        }
        if (evt.target.value > MAX_SUBS) {
          evt.target.value = MAX_SUBS;
        }
      });
    }
  );

  /* Attach method */
  Array.from(document.getElementsByClassName('increment-btn')).forEach(
    (element) => {
      element.addEventListener('click', updateQuantity);
    }
  );

  Array.from(document.getElementsByClassName('plan-select')).forEach(
    (element) => {
      element.addEventListener('click', goToPaymentPage);
    }
  );
}
