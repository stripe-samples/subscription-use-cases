// This code can be run on interval for each active metered subscription
// An example of an interval could be reporting usage once every 24 hours, or even once a minute.
const uuid = require('uuid/v4');
require('dotenv').config({ path: './.env' });
// Set your secret key. Remember to switch to your live secret key in production!
// See your keys here: https://dashboard.stripe.com/account/apikeys
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// Install uuid from npm

// Important: your own business logic is needed here before the next step.
// Here is where to pull a record of a customer from your own database.
// Extract the customer's Stripe Subscription Item ID and usage for today from your database record in preparation for reporting to Stripe.
const subscriptionItemID = '';
// The usage number you've been keeping track of in your own database for the last 24 hours (or the interval you have set for your needs)
const usageQuantity = 100;

// The idempotency key allows you to retry this usage record call if it fails (for example, a network timeout)
const idempotencyKey = uuid();
const timestamp = parseInt(Date.now() / 1000);

try {
  await stripe.subscriptionItems.createUsageRecord(
    subscriptionItemID,
    {
      quantity: usageQuantity,
      timestamp: timestamp,
      action: 'increment',
    },
    {
      idempotencyKey
    }
  );
} catch (error) {
  console.error(`usage report failed for item ID ${subscriptionItemID} wuith idempotency key ${idempotencyKey}: ${error.toString()}`);
}

