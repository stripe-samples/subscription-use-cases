<?php
use Slim\Http\Request;
use Slim\Http\Response;
use Stripe\Stripe;
require 'vendor/autoload.php';

$dotenv = Dotenv\Dotenv::create(__DIR__);
$dotenv->load();


require './config.php';

$app = new \Slim\App;

// Instantiate the logger as a dependency
$container = $app->getContainer();
$container['logger'] = function ($c) {
  $settings = $c->get('settings')['logger'];
  $logger = new Monolog\Logger($settings['name']);
  $logger->pushProcessor(new Monolog\Processor\UidProcessor());
  $logger->pushHandler(new Monolog\Handler\StreamHandler(__DIR__ . '/logs/app.log', \Monolog\Logger::DEBUG));
  return $logger;
};
$app->add(function ($request, $response, $next) {
    Stripe::setApiKey(getenv('STRIPE_SECRET_KEY'));
    return $next($request, $response);
});

$app->get('/', function (Request $request, Response $response, array $args) {
  // Display checkout page
  return $response->write(file_get_contents('../../client/index.html'));
});

$app->get('/config', function (Request $request, Response $response, array $args) {
  $pub_key = getenv('STRIPE_PUBLISHABLE_KEY');

  return $response->withJson(['publishableKey' => $pub_key]);
});

$app->post('/create-customer', function (Request $request, Response $response, array $args) {
  $body = json_decode($request->getBody());

  // Create a new customer object
  $customer = \Stripe\Customer::create([
    'email' => $body->email
  ]);

  return $response->withJson(['customer' => $customer]);
});

$app->post('/create-subscription', function (Request $request, Response $response, array $args) {
  $body = json_decode($request->getBody());


  try {
    $payment_method = \Stripe\PaymentMethod::retrieve(
      $body->paymentMethodId
    );
    $payment_method->attach([
      'customer' => $body->customerId,
    ]);
  } catch (Exception $e) {
    return $response->withJson($e->jsonBody);
  }


  // Set the default payment method on the customer
  \Stripe\Customer::update($body->customerId, [
    'invoice_settings' => [
      'default_payment_method' => $body->paymentMethodId
    ]
  ]);

  // Create the subscription
  $subscription = \Stripe\Subscription::create([
    'customer' => $body->customerId,
    'items' => [
      [
        'price' => getenv($body->priceId),
      ],
    ],
    'expand' => ['latest_invoice.payment_intent'],
  ]);

  return $response->withJson($subscription);
});

$app->post('/retry-invoice', function (Request $request, Response $response, array $args) {
  $body = json_decode($request->getBody());

  try {
    $payment_method = \Stripe\PaymentMethod::retrieve(
      $body->paymentMethodId
    );
    $payment_method->attach([
      'customer' => $body->customerId,
    ]);
  } catch (Exception $e) {
    return $response->withJson($e->jsonBody);
  }


  // Set the default payment method on the customer
  \Stripe\Customer::update($body->customerId, [
    'invoice_settings' => [
      'default_payment_method' => $body->paymentMethodId
    ]
  ]);

  $invoice = \Stripe\Invoice::retrieve([
    'id' => $body->invoiceId,
    'expand' => ['payment_intent'],
  ]);

  return $response->withJson($invoice);
});

$app->post('/retrieve-upcoming-invoice', function (Request $request, Response $response, array $args) {
  $body = json_decode($request->getBody());

  $subscription = \Stripe\Subscription::retrieve(
    $body->subscriptionId
  );

  $invoice = \Stripe\Invoice::upcoming([
    "customer" => $body->customerId,
    "subscription_prorate" => TRUE,
    "subscription" => $body->subscriptionId,
    "subscription_items" => [
      [
        'id' => $subscription->items->data[0]->id,
        'deleted' => TRUE,
        'clear_usage' => TRUE
      ],
      [
        'price' => getenv($body->newPriceId),
        'deleted' => FALSE
      ],
    ]
  ]);

  return $response->withJson($invoice);
});

$app->post('/cancel-subscription', function (Request $request, Response $response, array $args) {
  $body = json_decode($request->getBody());

  $subscription = \Stripe\Subscription::retrieve(
    $body->subscriptionId
  );
  $subscription->delete();

  return $response->withJson($subscription);
});

$app->post('/update-subscription', function (Request $request, Response $response, array $args) {
  $body = json_decode($request->getBody());

  $subscription = \Stripe\Subscription::retrieve($body->subscriptionId);

  $updatedSubscription = \Stripe\Subscription::update($body->subscriptionId, [
    'cancel_at_period_end' => false,
    'items' => [
      [
        'id' => $subscription->items->data[0]->id,
        'price' => getenv($body->newPriceId),
      ],
    ],
  ]);

  return $response->withJson($updatedSubscription);
});

$app->post('/retrieve-customer-payment-method', function (Request $request, Response $response, array $args) {
  $body = json_decode($request->getBody());

  $paymentMethod = \Stripe\PaymentMethod::retrieve(
    $body->paymentMethodId
  );

  return $response->withJson($paymentMethod);
});


$app->post('/stripe-webhook', function(Request $request, Response $response) {
    $logger = $this->get('logger');
    $event = $request->getParsedBody();
    // Parse the message body (and check the signature if possible)
    $webhookSecret = getenv('STRIPE_WEBHOOK_SECRET');
    if ($webhookSecret) {
      try {
        $event = \Stripe\Webhook::constructEvent(
          $request->getBody(),
          $request->getHeaderLine('stripe-signature'),
          $webhookSecret
        );

      } catch (\Exception $e) {
        return $response->withJson([ 'error' => $e->getMessage() ])->withStatus(403);
      }
    } else {
      $event = $request->getParsedBody();
    }
    $type = $event['type'];
    $object = $event['data']['object'];

    // Handle the event
    // Review important events for Billing webhooks
    // https://stripe.com/docs/billing/webhooks
    // Remove comment to see the various objects sent for this sample
    switch ($type) {
      case 'invoice.payment_succeeded':
        // The status of the invoice will show up as paid. Store the status in your
        // database to reference when a user accesses your service to avoid hitting rate
        // limits.
        $logger->info('🔔  Webhook received! ' . $object);
        break;
      case 'invoice.payment_failed':
        // If the payment fails or the customer does not have a valid payment method,
        // an invoice.payment_failed event is sent, the subscription becomes past_due.
        // Use this webhook to notify your user that their payment has
        // failed and to retrieve new card details.
        $logger->info('🔔  Webhook received! ' . $object);
        break;
      case 'invoice.finalized':
        // If you want to manually send out invoices to your customers
        // or store them locally to reference to avoid hitting Stripe rate limits.
          $logger->info('🔔  Webhook received! ' . $object);
        break;
      case 'customer.subscription.deleted':
        // handle subscription cancelled automatically based
        // upon your subscription settings. Or if the user
        // cancels it.
        $logger->info('🔔  Webhook received! ' . $object);
        break;
      case 'customer.subscription.trial_will_end':
        // Send notification to your user that the trial will end
        $logger->info('🔔  Webhook received! ' . $object);
        break;
      // ... handle other event types
      default:
        // Unhandled event type
    }

    return $response->withJson([ 'status' => 'success' ])->withStatus(200);
});

$app->run();
