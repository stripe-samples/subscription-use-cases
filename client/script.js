var stripe, customer, setupIntent, plan, card;

var planInfo = {
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

var stripeElements = function (publishableKey) {
  stripe = Stripe(publishableKey);

  if (document.getElementById('card-element')) {
    var elements = stripe.elements();

    // Card Element styles
    var style = {
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
      var el = document.getElementById('card-element-errors');
      el.classList.add('focused');
    });

    card.on('blur', function () {
      var el = document.getElementById('card-element-errors');
      el.classList.remove('focused');
    });

    card.on('change', function (event) {
      var displayError = document.getElementById('card-element-errors');
      if (event.error) {
        displayError.textContent = event.error.message;
      } else {
        displayError.textContent = '';
      }
    });
  }

  var signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', function (evt) {
      evt.preventDefault();
      changeLoadingState(true);
      // Create customer
      createCustomer().then((result) => {
        customer = result.customer;
        setupIntent = result.setupIntent;

        window.location.href =
          '/plans.html?customerId=' +
          customer.id +
          '&client_secret=' +
          setupIntent.client_secret;
      });
    });
  }
};

function goToPaymentPage(planId) {
  var date = new Date(); // Now
  date.setDate(date.getDate() + 30); // Set now + 30 days as the new date

  let day = date.getDate();
  let month = date.getMonth() + 1;
  let year = date.getFullYear();

  var trialEndDate = month + '/' + day + '/' + year;

  // Show the payment screen
  document.querySelector('#payment-form').classList.remove('hidden');
  // Display trial end date by showing 30 days in
  // the future
  document.getElementById('no-charge-until').innerHTML =
    '→ No charge until ' + trialEndDate;

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
    newPlanIdSelected,
    trialEndDate
  ).then(function (upcomingInvoice) {
    // Change the plan details for plan upgrade/downgrade
    // calculate if it's upgrade or downgrade
    document.getElementById(
      'current-plan-subscribed'
    ).innerHTML = currentSubscribedPlanId;
    document.getElementById('new-plan-selected').innerHTML = newPlanIdSelected;

    var nextPaymentAttemptDateToDisplay = getDateStringFromUnixTimestamp(
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

var confirmPlanChange = function () {
  const params = new URLSearchParams(document.location.search.substring(1));
  const subscriptionId = params.get('subscriptionId');
  var newPlanId = document.getElementById('new-plan-selected').innerHTML;

  updateSubscription(newPlanId, subscriptionId).then(function (result) {
    var searchParams = new URLSearchParams(window.location.search);
    searchParams.set('planId', newPlanId);
    searchParams.set('planHasChanged', true);
    window.location.search = searchParams.toString();
  });
};

var setupPaymentMethod = function () {
  const params = new URLSearchParams(document.location.search.substring(1));
  const client_secret = params.get('client_secret');
  const customerId = params.get('customerId');
  // Set up payment method for recurring usage
  var billingName = document.querySelector('#name').value;
  changeLoadingStatePlans(true);

  var planId = document.getElementById('planId').innerHTML.toLowerCase();

  stripe
    .confirmCardSetup(client_secret, {
      payment_method: {
        card: card,
        billing_details: {
          name: billingName,
        },
      },
    })
    .then(function (result) {
      if (result.error) {
        showCardError(result.error);
      } else {
        // Create the subscription
        createSubscription(
          customerId,
          result.setupIntent.payment_method,
          planId
        );
      }
    });
};

function createCustomer() {
  var billingEmail = document.querySelector('#email').value;

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
    .then(function (response) {
      return response.json();
    })
    .then(function (subscription) {
      orderComplete(planId, subscription, paymentMethodId);
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
    .then(function (response) {
      return response.json();
    })
    .then(function (invoice) {
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
    .then(function (response) {
      return response.json();
    })
    .then(function (response) {
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
    .then(function (response) {
      return response.json();
    })
    .then(function (response) {
      return response;
    });
}

function showCardError(error) {
  changeLoadingStatePlans(false);
  // The card was declined (i.e. insufficient funds, card has expired, etc)
  var errorMsg = document.getElementById('card-element-errors');
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
    .then(function (response) {
      return response.json();
    })
    .then(function (response) {
      // Set up Stripe Elements
      stripeElements(response.publishableKey);
    });
}

getConfig();

/* ------ Sample helpers ------- */

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function getDateStringFromUnixTimestamp(date) {
  var nextPaymentAttemptDate = new Date(date * 1000);
  let day = nextPaymentAttemptDate.getDate();
  let month = nextPaymentAttemptDate.getMonth() + 1;
  let year = nextPaymentAttemptDate.getFullYear();

  return month + '/' + day + '/' + year;
}

// For demo purpose only
function hasPlanChangedShowBanner() {
  var params = new URLSearchParams(document.location.search.substring(1));
  if (params.get('planHasChanged')) {
    document.querySelector('#plan-changed-alert').classList.remove('hidden');

    var current_period_end = params.get('current_period_end');
    var planId = params.get('planId');
    document.getElementById('plan-changing-to').innerText = planId;
    document.getElementById(
      'plan-changing-on'
    ).innerHTML = getDateStringFromUnixTimestamp(current_period_end);
    document.getElementById('subscription-status-text').innerText =
      'Subscription successfully updated';
  }
  var paymentMethodId = params.get('paymentMethodId');
  if (paymentMethodId) {
    retrieveCustomerPaymentMethod(paymentMethodId).then(function (response) {
      document.getElementById('credit-card-last-four').innerText =
        capitalizeFirstLetter(response.card.brand) +
        ' •••• ' +
        response.card.last4;

      document.getElementById('subscribed-plan').innerText =
        'Current plan: ' + capitalizeFirstLetter(params.get('planId'));
    });
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
var subscriptionCancelled = function () {
  document.querySelector('#subscription-cancelled').classList.remove('hidden');
  document.querySelector('#subscription-settings').classList.add('hidden');
  document.querySelector('#cancel-form').classList.add('hidden');
};

/* Shows a success / error message when the payment is complete */
var orderComplete = function (planId, subscription, paymentMethodId) {
  var subscriptionId = subscription.id;
  window.location.href =
    '/account.html?subscriptionId=' +
    subscriptionId +
    '&planId=' +
    planId +
    '&current_period_end=' +
    subscription.current_period_end +
    '&customerId=' +
    subscription.customer +
    '&trialEndDate=' +
    subscription.trial_end +
    '&paymentMethodId=' +
    paymentMethodId;
};

var demoChangePlan = function () {
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
};

// Changes the plan selected
var changePlanSelection = function (planId) {
  document.querySelector('#basic').classList.remove('border-pasha');
  document.querySelector('#premium').classList.remove('border-pasha');
  document.querySelector('#' + planId).classList.add('border-pasha');
};

// Show a spinner on subscription submission
var changeLoadingState = function (isLoading) {
  if (isLoading) {
    document.querySelector('#button-text').classList.add('hidden');
    document.querySelector('#signup-form button').disabled = true;
    document.querySelector('#loading').classList.add('loading');
  } else {
    document.querySelector('#signup-form button').disabled = false;
    document.querySelector('#loading').classList.remove('loading');
    document.querySelector('#button-text').classList.remove('hidden');
  }
};

// Show a spinner on subscription submission
var changeLoadingStatePlans = function (isLoading) {
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
};
