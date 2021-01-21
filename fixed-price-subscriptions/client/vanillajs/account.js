document.addEventListener('DOMContentLoaded', async () => {
  // Fetch the list of subscriptions for this customer.
  const {subscriptions} = await fetch('/subscriptions').then((r) => r.json());

  // Construct and display each subscription, its status, last4 of the card
  // used, and the current period end.
  const subscriptionsDiv = document.querySelector('#subscriptions');
  subscriptionsDiv.innerHTML = subscriptions.data.map((subscription) => {
    return `
      <hr>
      <h4>
        <a href="https://dashboard.stripe.com/test/subscriptions/${subscription.id}">
          ${subscription.id}
        </a>
      </h4>

      <p>
        Status: ${subscription.status}
      </p>

      <p>
        Card last4: ${subscription.default_payment_method.card.last4}
      </p>

      <p>
        Current period end: ${new Date(subscription.current_period_end * 1000)}
      </p>

      <!--<a href="change-payment-method.html?subscription=${subscription.id}"> Update payment method </a><br />
      <a href="change-plan.html?subscription=${subscription.id}"> Change plan </a><br /> -->
      <a href="cancel.html?subscription=${subscription.id}"> Cancel </a><br />
    `;
  }).join('<br />');
});
