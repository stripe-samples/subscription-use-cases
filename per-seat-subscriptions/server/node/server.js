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

  process.env.STRIPE_SECRET_KEY
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

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.use(express.static(process.env.STATIC_DIR));
// Use JSON parser for all non-webhook routes.
app.use((req, res, next) => {
  if (req.originalUrl === '/stripe-events') {
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

app.post('/retrieve-subscription-information', async (req, res) => {
  const subscriptionId = req.body.subscriptionId;
  console.log(
    'subscription id is ' + subscriptionId + ' type is ' + typeof subscriptionId
  );

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: [
      'latest_invoice',
      'customer.invoice_settings.default_payment_method',
      'plan.product',
    ],
  });

  const upcoming_invoice = await stripe.invoices.retrieveUpcoming({
    subscription: subscriptionId,
  });

  res.send({
    card: subscription.customer.invoice_settings.default_payment_method.card,
    product_description: subscription.plan.product.name,
    current_price: subscription.plan.id,
    current_quantity: subscription.items.data[0].quantity,
    latest_invoice: subscription.latest_invoice,
    upcoming_invoice: upcoming_invoice,
  });
});

app.post('/create-customer', async (req, res) => {
  // Create a new customer object
  const customer = await stripe.customers.create({
    email: req.body.email,
  });

  // save the customer.id as stripeCustomerId
  // in your database.

  res.send({ customer });
});

app.post('/create-subscription', async (req, res) => {
  // Set the default payment method on the customer
  try {
    await stripe.paymentMethods.attach(req.body.paymentMethodId, {
      customer: req.body.customerId,
    });
  } catch (error) {
    return res.status('402').send({ error: { message: error.message } });
  }

  let updateCustomerDefaultPaymentMethod = await stripe.customers.update(
    req.body.customerId,
    {
      invoice_settings: {
        default_payment_method: req.body.paymentMethodId,
      },
    }
  );

  // Create the subscription
  const subscription = await stripe.subscriptions.create({
    customer: req.body.customerId,
    items: [
      { price: process.env[req.body.priceId], quantity: req.body.quantity },
    ],
    expand: ['latest_invoice.payment_intent', 'plan.product'],
  });

  res.send(subscription);
});

app.post('/retry-invoice', async (req, res) => {
  // Set the default payment method on the customer

  try {
    await stripe.paymentMethods.attach(req.body.paymentMethodId, {
      customer: req.body.customerId,
    });
    await stripe.customers.update(req.body.customerId, {
      invoice_settings: {
        default_payment_method: req.body.paymentMethodId,
      },
    });
  } catch (error) {
    // in case card_decline error
    return res
      .status('402')
      .send({ result: { error: { message: error.message } } });
  }

  const invoice = await stripe.invoices.retrieve(req.body.invoiceId, {
    expand: ['payment_intent'],
  });
  res.send(invoice);
});

app.post('/retrieve-upcoming-invoice', async (req, res) => {
  const new_price = process.env[req.body.newPriceId.toUpperCase()];
  const quantity = req.body.quantity;
  const subscriptionId = req.body.subscriptionId;

  var params = {};
  params['customer'] = req.body.customerId;
  var subscription;

  if (subscriptionId != null) {
    params['subscription'] = subscriptionId;
    subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const current_price = subscription.items.data[0].price.id;

    if (current_price == new_price) {
      params['subscription_items'] = [
        {
          id: subscription.items.data[0].id,
          quantity: quantity,
        },
      ];
    } else {
      params['subscription_items'] = [
        {
          id: subscription.items.data[0].id,
          deleted: true,
        },
        {
          price: new_price,
          quantity: quantity,
        },
      ];
    }
  } else {
    params['subscription_items'] = [
      {
        price: new_price,
        quantity: quantity,
      },
    ];
  }
  console.log('params are ' + JSON.stringify(params));

  const invoice = await stripe.invoices.retrieveUpcoming(params);

  response = {};

  if (subscriptionId != null) {
    const current_period_end = subscription.current_period_end;
    var immediate_total = 0;
    var next_invoice_sum = 0;

    invoice.lines.data.forEach((invoiceLineItem) => {
      if (invoiceLineItem.period.end == current_period_end) {
        immediate_total += invoiceLineItem.amount;
      } else {
        next_invoice_sum += invoiceLineItem.amount;
      }
    });

    response = {
      immediate_total: immediate_total,
      next_invoice_sum: next_invoice_sum,
      invoice: invoice,
    };
  } else {
    response = {
      invoice: invoice,
    };
  }

  res.send(response);
});

app.post('/cancel-subscription', async (req, res) => {
  // Delete the subscription
  const deletedSubscription = await stripe.subscriptions.del(
    req.body.subscriptionId
  );
  res.send(deletedSubscription);
});

app.post('/update-subscription', async (req, res) => {
  const subscriptionId = req.body.subscriptionId;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const current_price = subscription.items.data[0].price.id;
  const new_price = process.env[req.body.newPriceId.toUpperCase()];
  const quantity = req.body.quantity;
  var updatedSubscription;

  if (current_price == new_price) {
    updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          quantity: quantity,
        },
      ],
    });
  } else {
    updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          deleted: true,
        },
        {
          price: new_price,
          quantity: quantity,
        },
      ],
      expand: ['plan.product'],
    });
  }

  var invoice = await stripe.invoices.create({
    customer: subscription.customer,
    subscription: subscription.id,
    description:
      'Change to ' +
      quantity +
      ' seat(s) on the ' +
      updatedSubscription.plan.product.name +
      ' plan',
  });

  invoice = await stripe.invoices.pay(invoice.id);
  res.send(updatedSubscription);
});

// Webhook handler for asynchronous events.
app.post(
  '/stripe-webhook',
  bodyParser.raw({ type: 'application/json' }),
  async (req, res) => {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(err);
      console.log(`⚠️  Webhook signature verification failed.`);
      console.log(
        `⚠️  Check the env file and enter the correct webhook secret.`
      );
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    const dataObject = event.data.object;

    // Handle the event
    // Review important events for Billing webhooks
    // https://stripe.com/docs/billing/webhooks
    // Remove comment to see the various objects sent for this sample
    switch (event.type) {
      case 'invoice.paid':
        // Used to provision services after the trial has ended.
        // The status of the invoice will show up as paid. Store the status in your
        // database to reference when a user accesses your service to avoid hitting rate limits.
        break;
      case 'invoice.payment_failed':
        // If the payment fails or the customer does not have a valid payment method,
        //  an invoice.payment_failed event is sent, the subscription becomes past_due.
        // Use this webhook to notify your user that their payment has
        // failed and to retrieve new card details.
        break;
      case 'invoice.finalized':
        // If you want to manually send out invoices to your customers
        // or store them locally to reference to avoid hitting Stripe rate limits.
        break;
      case 'customer.subscription.deleted':
        if (event.request != null) {
          // handle a subscription cancelled by your request
          // from above.
        } else {
          // handle subscription cancelled automatically based
          // upon your subscription settings.
        }
        break;
      case 'customer.subscription.trial_will_end':
        // Send notification to your user that the trial will end
        break;
      default:
      // Unexpected event type
    }
    res.sendStatus(200);
  }
);

app.listen(4242, () => console.log(`Node server listening on port ${4242}!`));
