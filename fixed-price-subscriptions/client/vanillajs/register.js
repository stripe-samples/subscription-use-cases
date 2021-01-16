const signupForm = document.querySelector('#signup-form');

if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailInput = document.querySelector('#email');

    // Create a customer. This will also set a cookie on the server
    // to simulate having a logged in user.
    const {customer} = await fetch('/create-customer', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: emailInput.value,
      }),
    });

    // Redirect to the pricing page.
    window.location.href = '/prices.html';
  });
}
