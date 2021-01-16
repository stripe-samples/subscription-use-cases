const params = new URLSearchParams(window.location.search);
const subscriptionId = params.get('subscription');

const cancelBtn = document.querySelector('#cancel-btn');
cancelBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  setMessage("Cancelling subscription...");

  const {subscription} = await fetch('/cancel-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscriptionId
    }),
  })
  .then((response) => response.json())

  setMessage(`Subscription status: ${subscription.status}`);
  setMessage(`Redirecting back to account in 7s.`);
  setTimeout(() => {
    window.location.href = "account.html";
  }, 7 * 1000);

});

const setMessage = (message) => {
  const messagesDiv = document.querySelector('#messages');
  messagesDiv.innerHTML += "<br>" + message;
}
