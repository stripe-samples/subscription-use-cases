let stripe, customer, plan, card;

let planInfo = {
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

        window.location.href = '/plans.html?customerId=' + customer.id;
      });
    });
  }

  let paymentForm = document.getElementById('payment-form');
  if (paymentForm) {
    paymentForm.addEventListener('submit', function (evt) {
      evt.preventDefault();
      changeLoadingStatePlans(true);

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
  changeLoadingStatePlans(false);
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

  let planId = document.getElementById('planId').innerHTML.toUpperCase();

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
        displayError(error);
      } else {
        if (isPaymentRetry) {
          // Update the payment method and retry invoice payment
          retryInvoiceWithNewPaymentMethod(
            customerId,
            result.paymentMethod.id,
            invoiceId,
            planId
          );
        } else {
          // Create the subscription
          createSubscription(customerId, result.paymentMethod.id, planId);
        }
      }
    });
}

function goToPaymentPage(planId) {
  // Show the payment screen
  document.querySelector('#payment-form').classList.remove('hidden');

  document.getElementById('total-due-now').innerText = getFormattedAmount(
    planInfo[planId].amount
  );

  // Add the plan selected
  document.getElementById('plan-selected').innerHTML =
    '→ Subscribing to ' +
    '<span id="planId" class="font-bold">' +
    planInfo[planId].name +
    '</span>';

  // Update the border to show which plan is selected
  changePlanSelection(planId);
}

function changePlan() {
  demoChangePlan();
}

function switchPlans(newPlanIdSelected) {
  const params = new URLSearchParams(document.location.search.substring(1));
  const currentSubscribedPlanId = params.get('planId');
  const customerId = params.get('customerId');
  const subscriptionId = params.get('subscriptionId');
  // Update the border to show which plan is selected
  changePlanSelection(newPlanIdSelected);

  changeLoadingStatePlans(true);

  // Retrieve the upcoming invoice to display details about
  // the plan change
  retrieveUpcomingInvoice(customerId, subscriptionId, newPlanIdSelected).then(
    (upcomingInvoice) => {
      // Change the plan details for plan upgrade/downgrade
      // calculate if it's upgrade or downgrade
      document.getElementById(
        'current-plan-subscribed'
      ).innerHTML = currentSubscribedPlanId;
      document.getElementById(
        'new-plan-selected'
      ).innerHTML = newPlanIdSelected;

      let nextPaymentAttemptDateToDisplay = getDateStringFromUnixTimestamp(
        upcomingInvoice.next_payment_attempt
      );
      document.getElementById(
        'new-plan-start-date'
      ).innerHTML = nextPaymentAttemptDateToDisplay;

      document.getElementById('new-plan-price').innerHTML =
        '$' + upcomingInvoice.amount_due / 100 + '/month';
      changeLoadingStatePlans(false);
    }
  );

  if (currentSubscribedPlanId != newPlanIdSelected) {
    document.querySelector('#plan-change-form').classList.remove('hidden');
  } else {
    document.querySelector('#plan-change-form').classList.add('hidden');
  }
}

function confirmPlanChange() {
  const params = new URLSearchParams(document.location.search.substring(1));
  const subscriptionId = params.get('subscriptionId');
  let newPlanId = document.getElementById('new-plan-selected').innerHTML;

  updateSubscription(newPlanId.toUpperCase(), subscriptionId).then((result) => {
    let searchParams = new URLSearchParams(window.location.search);
    searchParams.set('planId', newPlanId);
    searchParams.set('planHasChanged', true);
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

function handleCustomerActionRequired({
  subscription,
  invoice,
  planId,
  paymentMethodId,
  isRetry,
}) {
  if (subscription && subscription.status === 'active') {
    // subscription is active, no customer actions required.
    return { subscription, planId, paymentMethodId };
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
            // listen to invoice.payment_succeeded. This webhook endpoint
            // returns an Invoice.
            return {
              planId: planId,
              subscription: subscription,
              invoice: invoice,
              paymentMethodId: paymentMethodId,
            };
          }
        }
      })
      .catch((error) => {
        displayError(error);
      });
  } else {
    // No customer action needed
    return { subscription, planId, paymentMethodId };
  }
}

function handlePaymentMethodRequired({
  subscription,
  paymentMethodId,
  planId,
}) {
  if (subscription.status === 'active') {
    // subscription is active, no customer actions required.
    return { subscription, planId, paymentMethodId };
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
    return { subscription, planId, paymentMethodId };
  }
}

function onSubscriptionComplete(result) {
  // Payment was successful. Provision access to your service.
  // Remove invoice from localstorage because payment is now complete.
  clearCache();
  // Change your UI to show a success message to your customer.
  onSubscriptionSampleDemoComplete(result);
  // Call your backend to grant access to your service based on
  // the product your customer subscribed to.
  // Get the product by using result.subscription.plan.product
}

function createSubscription(customerId, paymentMethodId, planId) {
  return (
    fetch('/create-subscription', {
      method: 'post',
      headers: {
        'Content-type': 'application/json',
      },
      body: JSON.stringify({
        customerId: customerId,
        paymentMethodId: paymentMethodId,
        planId: planId,
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
          planId: planId,
        };
      })
      // Some payment methods require a customer to do additional
      // authentication with their financial institution.
      // Eg: 2FA for cards.
      .then(handleCustomerActionRequired)
      // If attaching this card to a Customer object succeeds,
      // but attempts to charge the customer fail. You will
      // get a requires_payment_method error.
      .then(handlePaymentMethodRequired)
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
  planId
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
          planId: planId,
          isRetry: true,
        };
      })
      // Some payment methods require a customer to be on session
      // to complete the payment process. Check the status of the
      // payment intent to handle these actions.
      .then(handleCustomerActionRequired)
      // No more actions required. Provision your service for the user.
      .then(onSubscriptionComplete)
      .catch((error) => {
        // An error has happened. Display the failure to the user here.
        // We utilize the HTML element we created.
        displayError(error);
      })
  );
}

function retrieveUpcomingInvoice(customerId, subscriptionId, newPlanId) {
  return fetch('/retrieve-upcoming-invoice', {
    method: 'post',
    headers: {
      'Content-type': 'application/json',
    },
    body: JSON.stringify({
      customerId: customerId,
      subscriptionId: subscriptionId,
      newPlanId: newPlanId,
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
  changeLoadingStatePlans(true);
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

function updateSubscription(planId, subscriptionId) {
  return fetch('/update-subscription', {
    method: 'post',
    headers: {
      'Content-type': 'application/json',
    },
    body: JSON.stringify({
      subscriptionId: subscriptionId,
      newPlanId: planId,
    }),
  })
    .then((response) => {
      return response.json();
    })
    .then((response) => {
      return response;
    });
}

function retrieveCustomerPaymentMethod(paymentMethodId) {
  return fetch('/retrieve-customer-payment-method', {
    method: 'post',
    headers: {
      'Content-type': 'application/json',
    },
    body: JSON.stringify({
      paymentMethodId: paymentMethodId,
    }),
  })
    .then((response) => {
      return response.json();
    })
    .then((response) => {
      return response;
    });
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
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function getDateStringFromUnixTimestamp(date) {
  let nextPaymentAttemptDate = new Date(date * 1000);
  let day = nextPaymentAttemptDate.getDate();
  let month = nextPaymentAttemptDate.getMonth() + 1;
  let year = nextPaymentAttemptDate.getFullYear();

  return month + '/' + day + '/' + year;
}

// For demo purpose only
function hasPlanChangedShowBanner() {
  let params = new URLSearchParams(document.location.search.substring(1));
  if (params.get('planHasChanged')) {
    document.querySelector('#plan-changed-alert').classList.remove('hidden');

    let currentPeriodEnd = params.get('currentPeriodEnd');
    let planId = params.get('planId');
    document.getElementById('plan-changing-to').innerText = planId;
    document.getElementById(
      'plan-changing-on'
    ).innerHTML = getDateStringFromUnixTimestamp(currentPeriodEnd);
    document.getElementById('subscription-status-text').innerText =
      'Subscription changed';
  }
  let paymentMethodId = params.get('paymentMethodId');
  if (paymentMethodId) {
    retrieveCustomerPaymentMethod(paymentMethodId).then(function (response) {
      document.getElementById('credit-card-last-four').innerText =
        capitalizeFirstLetter(response.card.brand) +
        ' •••• ' +
        response.card.last4;

      document.getElementById(
        'subscribed-plan'
      ).innerText = capitalizeFirstLetter(params.get('planId').toLowerCase());
    });
  }
}

hasPlanChangedShowBanner();

// Shows the cancellation response
function subscriptionCancelled() {
  document.querySelector('#subscription-cancelled').classList.remove('hidden');
  document.querySelector('#subscription-settings').classList.add('hidden');
}

/* Shows a success / error message when the payment is complete */
function onSubscriptionSampleDemoComplete({
  planId: planId,
  subscription: subscription,
  paymentMethodId: paymentMethodId,
  invoice: invoice,
}) {
  let subscriptionId;
  let currentPeriodEnd;
  let customerId;
  if (subscription) {
    subscriptionId = subscription.id;
    currentPeriodEnd = subscription.current_period_end;
    customerId = subscription.customer;
  } else {
    const params = new URLSearchParams(document.location.search.substring(1));
    subscriptionId = invoice.subscription;
    currentPeriodEnd = params.get('currentPeriodEnd');
    customerId = invoice.customer;
  }

  window.location.href =
    '/account.html?subscriptionId=' +
    subscriptionId +
    '&planId=' +
    planId +
    '&currentPeriodEnd=' +
    currentPeriodEnd +
    '&customerId=' +
    customerId +
    '&paymentMethodId=' +
    paymentMethodId;
}

function demoChangePlan() {
  document.querySelector('#basic').classList.remove('border-pasha');
  document.querySelector('#premium').classList.remove('border-pasha');
  document.querySelector('#plan-change-form').classList.add('hidden');

  // Grab the PlanID from the URL
  // This is meant for the demo, replace with a cache or database.
  const params = new URLSearchParams(document.location.search.substring(1));
  const planId = params.get('planId').toLowerCase();

  // Show the change plan screen
  document.querySelector('#plans-form').classList.remove('hidden');
  document
    .querySelector('#' + planId.toLowerCase())
    .classList.add('border-pasha');

  let elements = document.querySelectorAll(
    '#submit-' + planId + '-button-text'
  );
  for (let i = 0; i < elements.length; i++) {
    elements[0].childNodes[3].innerText = 'Current';
  }
  if (planId === 'premium') {
    document.getElementById('submit-premium').disabled = true;
    document.getElementById('submit-basic').disabled = false;
  } else {
    document.getElementById('submit-premium').disabled = false;
    document.getElementById('submit-basic').disabled = true;
  }
}

// Changes the plan selected
function changePlanSelection(planId) {
  document.querySelector('#basic').classList.remove('border-pasha');
  document.querySelector('#premium').classList.remove('border-pasha');
  document
    .querySelector('#' + planId.toLowerCase())
    .classList.add('border-pasha');
}

// Show a spinner on subscription submission
function changeLoadingState(isLoading) {
  if (isLoading) {
    document.querySelector('#button-text').classList.add('hidden');
    document.querySelector('#signup-form button').disabled = true;
    document.querySelector('#loading').classList.add('loading');
  } else {
    document.querySelector('#signup-form button').disabled = false;
    document.querySelector('#loading').classList.remove('loading');
    document.querySelector('#button-text').classList.remove('hidden');
  }
}

// Show a spinner on subscription submission
function changeLoadingStatePlans(isLoading) {
  if (isLoading) {
    let buttons = document.querySelectorAll('#button-text');
    let loading = document.querySelectorAll('#loading');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].classList.add('hidden');
      loading[i].classList.add('loading');
    }
    document.querySelector('#submit-basic').classList.add('invisible');
    document.querySelector('#submit-premium').classList.add('invisible');
    if (document.getElementById('confirm-plan-change-cancel')) {
      document
        .getElementById('confirm-plan-change-cancel')
        .classList.add('invisible');
      // document
      //   .getElementById('confirm-plan-change-submit')
      //   .classList.add('invisible');
    }
  } else {
    let buttons = document.querySelectorAll('#button-text');
    let loading = document.querySelectorAll('#loading');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].classList.remove('hidden');
      loading[i].classList.remove('loading');
    }
    document.querySelector('#submit-basic').classList.remove('invisible');
    document.querySelector('#submit-premium').classList.remove('invisible');
    if (document.getElementById('confirm-plan-change-cancel')) {
      document
        .getElementById('confirm-plan-change-cancel')
        .classList.remove('invisible');
      document
        .getElementById('confirm-plan-change-submit')
        .classList.remove('invisible');
    }
  }
}

function clearCache() {
  localStorage.clear();
}

function resetDemo() {
  clearCache();
  window.location.href = '/';
}
