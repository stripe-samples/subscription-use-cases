let stripe, customer, plan, card;

let planInfo = {
  basic: {
    amount: '500',
    interval: 'monthly',
    currency: 'USD',
  },
  premium: {
    amount: '1500',
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
          color: 'rgba(0,0,0,0.4)',
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
      // setup payment method & create subscription
      setupPaymentMethod(card);
    });
  }

  let updatePaymentForm = document.getElementById('update-payment-form');
  if (updatePaymentForm) {
    updatePaymentForm.addEventListener('submit', function (evt) {
      evt.preventDefault();
      changeLoadingStatePlans(true);
      // setup payment method & create subscription
      updatePaymentMethodAndRetryInvoicePayment(card);
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

function setupPaymentMethod(card) {
  const params = new URLSearchParams(document.location.search.substring(1));
  const customerId = params.get('customerId');
  // Set up payment method for recurring usage
  let billingName = document.querySelector('#name').value;

  let planId = document.getElementById('planId').innerHTML.toLowerCase();

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
        showCardError(result.error);
      } else {
        // Create the subscription
        createSubscription(
          customerId,
          result.paymentMethod.id,
          planId.toUpperCase()
        );
      }
    });
}

function updatePaymentMethodAndRetryInvoicePayment(card) {
  const params = new URLSearchParams(document.location.search.substring(1));
  let customerId = params.get('customerId');
  let invoiceId = params.get('invoiceId');
  let planId = params.get('planId');

  stripe
    .createPaymentMethod({
      type: 'card',
      card: card,
    })
    .then((result) => {
      if (result.error) {
        showCardError(result.error);
      } else {
        // Update the payment method and retry invoice payment
        retryInvoiceWithNewPaymentMethod(
          customerId,
          result.paymentMethod.id,
          invoiceId,
          planId
        );
      }
    });
}

function goToPaymentPage(planId) {
  let date = new Date(); // Now
  date.setDate(date.getDate() + 30); // Set now + 30 days as the new date

  let day = date.getDate();
  let month = date.getMonth() + 1;
  let year = date.getFullYear();

  let trialEndDate = month + '/' + day + '/' + year;

  // Show the payment screen
  document.querySelector('#payment-form').classList.remove('hidden');
  // Display trial end date by showing 30 days in
  // the future

  document.getElementById('total-due-now').innerText = getFormattedAmount(
    planInfo[planId].amount
  );

  // Add the plan selected
  document.getElementById('plan-selected').innerHTML =
    '→ Subscribing to ' +
    '<span id="planId" class="font-bold">' +
    capitalizeFirstLetter(planId) +
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
  const currentPeriodEnd = params.get('current_period_end');
  const customerId = params.get('customerId');
  const subscriptionId = params.get('subscriptionId');
  const trialEndDate = params.get('trialEndDate');
  // Update the border to show which plan is selected
  changePlanSelection(newPlanIdSelected);

  changeLoadingStatePlans(true);

  // Retrieve the upcoming invoice to display details about
  // the plan change
  retrieveUpcomingInvoice(
    customerId,
    subscriptionId,
    newPlanIdSelected.toUpperCase(),
    trialEndDate
  ).then(function (upcomingInvoice) {
    // Change the plan details for plan upgrade/downgrade
    // calculate if it's upgrade or downgrade
    document.getElementById(
      'current-plan-subscribed'
    ).innerHTML = currentSubscribedPlanId;
    document.getElementById('new-plan-selected').innerHTML = newPlanIdSelected;

    let nextPaymentAttemptDateToDisplay = getDateStringFromUnixTimestamp(
      upcomingInvoice.next_payment_attempt
    );
    document.getElementById(
      'new-plan-start-date'
    ).innerHTML = nextPaymentAttemptDateToDisplay;

    document.getElementById('new-plan-price').innerHTML =
      '$' + upcomingInvoice.amount_due / 100 + '/month';
    changeLoadingStatePlans(false);
  });

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

  updateSubscription(newPlanId.toUpperCase(), subscriptionId).then(function (
    result
  ) {
    let searchParams = new URLSearchParams(window.location.search);
    searchParams.set('planId', newPlanId);
    searchParams.set('planHasChanged', true);
    window.location.search = searchParams.toString();
  });
}

function requiresPaymentMethodError(
  customerId,
  invoiceId,
  amountDue,
  currentPeriodEnd,
  planId
) {
  window.location.href =
    '/updateCard.html?customerId=' +
    customerId +
    '&planId=' +
    planId +
    '&invoiceId=' +
    invoiceId +
    '&amountDue=' +
    amountDue +
    '&currentPeriodEnd=' +
    currentPeriodEnd;
}

function confirmSubscription({
  planId: planId,
  subscription: subscription,
  paymentMethodId: paymentMethodId,
  invoice: invoice,
    isRetry: isRetry,
}) {
  let pending_setup_intent;
  let payment_intent;
  if (subscription) {
    pending_setup_intent = subscription.pending_setup_intent;
    const { latest_invoice } = subscription;
    payment_intent = latest_invoice.payment_intent;
  } else if (invoice) {
    payment_intent = invoice.payment_intent;
  }

  if (payment_intent) {
    const { client_secret, status } = payment_intent;

    if (status === 'requires_action' || (status === 'requires_payment_method' && isRetry)) {
        stripe.confirmCardPayment(client_secret, {payment_method: paymentMethodId}).then(function (result) {
        if (result.error) {
          // start code flow to handle updating the payment details
          // Display error message in your UI.
          // The card was declined (i.e. insufficient funds, card has expired, etc)
          displayError(result);
        } else {
          // Show a success message to your customer
          subscriptionComplete({
            planId: planId,
            subscription: subscription,
            paymentMethodId: paymentMethodId,
            invoice: invoice,
          });
        }
      });
    } else if (status === 'requires_payment_method') {
      requiresPaymentMethodError(
        subscription.customer,
        subscription.latest_invoice.id,
        subscription.latest_invoice.amount_due,
        subscription.current_period_end,
        planId
      );
    } else {
      // No additional information was needed
      // The subscription is completed, show a success message to your customer
      // and provision access to your service.
      // subscriptionComplete(planId, subscription, paymentMethodId);
      subscriptionComplete({
        planId: planId,
        subscription: subscription,
        paymentMethodId: paymentMethodId,
        invoice: invoice,
      });
    }
  } else if (pending_setup_intent) {
    const { client_secret, status } = subscription.pending_setup_intent;

    if (status === 'requires_action') {
        stripe.confirmCardSetup(client_secret, {payment_method: paymentMethodId}).then(function (result) {
        if (result.error) {
          // Display error.message in your UI.
          displayError(result);
        } else {
          // The subscription is completed, show a success message to your customer
          // and provision access to your service.
          subscriptionComplete({
            planId: planId,
            subscription: subscription,
            paymentMethodId: paymentMethodId,
            invoice: invoice,
          });
        }
      });
    } else {
      // No additional information was needed
      // The subscription is completed, show a success message to your customer
      // and provision access to your service.
      // subscriptionComplete(planId, subscription, paymentMethodId);
      subscriptionComplete({
        planId: planId,
        subscription: subscription,
        paymentMethodId: paymentMethodId,
        invoice: invoice,
      });
    }
  } else {
    subscriptionComplete({
      planId: planId,
      subscription: subscription,
      paymentMethodId: paymentMethodId,
      invoice: invoice,
    });
  }
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

function createSubscription(customerId, paymentMethodId, planId) {
  return fetch('/create-subscription', {
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
    .then((result) => {
      console.log(result.error);
      if (result.error) {
        // The card has had an error
        displayError(result.error);
      } else {
        confirmSubscription({
          planId: planId,
          subscription: result,
            paymentMethodId: paymentMethodId,
            isRetry: false,
        });
      }
    });
}

function retryInvoiceWithNewPaymentMethod(
  customerId,
  paymentMethodId,
  invoiceId,
  planId
) {
  return fetch('/update-customer-payment-method-retry-invoice', {
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
    .then((result) => {
      if (result.error) {
        // The card has had an error
        displayError(result.error);
      } else {
        confirmSubscription({
          planId: planId,
          paymentMethodId: paymentMethodId,
            invoice: result,
            isRetry: true,
        });
      }
    });
}

function retrieveUpcomingInvoice(
  customerId,
  subscriptionId,
  newPlanId,
  trialEndDate
) {
  return fetch('/retrieve-upcoming-invoice', {
    method: 'post',
    headers: {
      'Content-type': 'application/json',
    },
    body: JSON.stringify({
      customerId: customerId,
      subscriptionId: subscriptionId,
      subscription_trial_end: trialEndDate,
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
  return fetch('/retrieve-customer-paymentMethod', {
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

function showCardError(error) {
  changeLoadingStatePlans(false);
  // The card was declined (i.e. insufficient funds, card has expired, etc)
  let errorMsg = document.getElementById('card-element-errors');
  errorMsg.textContent = error.message;
  setTimeout(function () {
    errorMsg.textContent = '';
  }, 8000);
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

    let current_period_end = params.get('current_period_end');
    let planId = params.get('planId');
    document.getElementById('plan-changing-to').innerText = planId;
    document.getElementById(
      'plan-changing-on'
    ).innerHTML = getDateStringFromUnixTimestamp(current_period_end);
    document.getElementById('subscription-status-text').innerText =
      'Subscription successfully updated';
  }
  let paymentMethodId = params.get('paymentMethodId');
  if (paymentMethodId) {
    retrieveCustomerPaymentMethod(paymentMethodId).then(function (response) {
      document.getElementById('credit-card-last-four').innerText =
        capitalizeFirstLetter(response.card.brand) +
        ' •••• ' +
        response.card.last4;

      document.getElementById('subscribed-plan').innerText =
        'Current plan: ' +
        capitalizeFirstLetter(params.get('planId').toLowerCase());
    });
  }

  let invoiceId = params.get('invoiceId');
  let amountDue = params.get('amountDue');
  if (invoiceId) {
    document.getElementById('total-due-now').innerText = getFormattedAmount(
      amountDue
    );
  }
}

hasPlanChangedShowBanner();

function showCancel() {
  document.querySelector('#cancel-form').classList.remove('hidden');
  document.querySelector('#plans-form').classList.add('hidden');
}

function cancelChangePlan() {
  document.querySelector('#plans-form').classList.add('hidden');
}

// Shows the cancellation response
function subscriptionCancelled() {
  document.querySelector('#subscription-cancelled').classList.remove('hidden');
  document.querySelector('#subscription-settings').classList.add('hidden');
  document.querySelector('#cancel-form').classList.add('hidden');
}

/* Shows a success / error message when the payment is complete */
function subscriptionComplete({
  planId: planId,
  subscription: subscription,
  paymentMethodId: paymentMethodId,
  invoice: invoice,
}) {
  let subscriptionId;
  let current_period_end;
  let customerId;
  if (subscription) {
    subscritionId = subscription.id;
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
    '&current_period_end=' +
    current_period_end +
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
  const planId = params.get('planId');

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
  // Hide cancel form if needed
  document.querySelector('#cancel-form').classList.add('hidden');
}

// Changes the plan selected
function changePlanSelection(planId) {
  document.querySelector('#basic').classList.remove('border-pasha');
  document.querySelector('#premium').classList.remove('border-pasha');
  document.querySelector('#' + planId).classList.add('border-pasha');
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
  } else {
    let buttons = document.querySelectorAll('#button-text');
    let loading = document.querySelectorAll('#loading');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].classList.remove('hidden');
      loading[i].classList.remove('loading');
    }
  }
}
