const express = require('express');
const app = express();
const { resolve } = require('path');
const bodyParser = require('body-parser');
// Replace if using a different env file or config
require('dotenv').config({ path: './.env' });

if (
  !process.env.STRIPE_SECRET_KEY ||
  !process.env.STRIPE_PUBLISHABLE_KEY ||
  !process.env.BASIC ||
  !process.env.PREMIUM ||
  !process.env.STATIC_DIR
) {
  console.log(
    'The .env file is not configured. Follow the instructions in the readme to configure the .env file. https://github.com/stripe-samples/subscription-use-cases'
  );
  console.log('');
  process.env.STRIPE_SECRET_KEY
    ? ''
    : console.log('Add STRIPE_SECRET_KEY to your .env file.');

  process.env.STRIPE_PUBLISHABLE_KEY
    ? ''
    : console.log('Add STRIPE_PUBLISHABLE_KEY to your .env file.');

  process.env.BASIC
    ? ''
    : console.log(
        'Add BASIC priceID to your .env file. See repo readme for setup instructions.'
      );

  process.env.PREMIUM
    ? ''
    : console.log(
        'Add PREMIUM priceID to your .env file. See repo readme for setup instructions.'
      );

  process.env.STATIC_DIR
    ? ''
    : console.log(
        'Add STATIC_DIR to your .env file. Check .env.example in the root folder for an example'
      );

  process.exit();
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-09-30.acacia',
  appInfo: {
    // For sample support and debugging, not required for production:
    name: 'stripe-samples/subscription-use-cases/usage-based-subscriptions',
    version: '0.0.1',
    url: 'https://github.com/stripe-samples/subscription-use-cases/usage-based-subscriptions',
  },
});

app.use(express.static(process.env.STATIC_DIR));
// Use JSON parser for all non-webhook routes.
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    next();
  } else {
    bodyParser.json()(req, res, next);
  }
});

app.get('/', (req, res) => {
  const path = resolve(process.env.STATIC_DIR + '/index.html');
  res.sendFile(path);
});

app.get('/config', async (req, res) => {
  res.send({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

app.post('/create-customer', async (req, res) => {
  try {
    const customer = await stripe.customers.create({
      name: req.body.name,
      email: req.body.email,
    });
    res.send({ customer });
  } catch (error) {
    res.status(400).send({ error: { message: error.message } });
  }
});

app.post('/create-meter', async (req, res) => {
  try {
    const meter = await stripe.billing.meters.create({
      display_name: req.body.displayName,
      event_name: req.body.eventName,
      default_aggregation: {
        formula: req.body.aggregationFormula,
      },
    });
    res.send({ meter });
  } catch (error) {
    res.status(400).send({ error: { message: error.message } });
  }
});

app.post('/create-meter-event', async (req, res) => {
  console.log(req.body);
  try {
    const meterEvent = await stripe.v2.billing.meterEvents.create({
      event_name: req.body.eventName,
      payload: {
        value: req.body.value + '',
        stripe_customer_id: req.body.customerId,
      },
    });
    res.send({ meterEvent });
  } catch (error) {
    res.status(400).send({ error: { message: error.message } });
  }
});

app.post('/create-price', async (req, res) => {
  try {
    const price = await stripe.prices.create({
      currency: req.body.currency,
      unit_amount: req.body.amount,
      recurring: {
        interval: 'month',
        meter: req.body.meterId,
        usage_type: 'metered',
      },
      product_data: {
        name: req.body.productName,
      },
    });
    res.send({ price });
  } catch (error) {
    res.status(400).send({ error: { message: error.message } });
  }
});

app.post('/create-subscription', async (req, res) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: req.body.customerId,
      items: [{ price: req.body.priceId }],
      expand: ['pending_setup_intent'],
    });
    res.send({ subscription });
  } catch (error) {
    res.status(400).send({ error: { message: error.message } });
  }
});

app.listen(4242, () => console.log(`Node server listening on port ${4242}!`));
