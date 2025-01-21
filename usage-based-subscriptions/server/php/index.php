<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;
use DI\Container;
use Stripe\Stripe;
require 'vendor/autoload.php';

error_reporting(0);

$dotenv = Dotenv\Dotenv::create(__DIR__, null, null);
$dotenv->load();

require './config.php';

$container = new \DI\Container();

AppFactory::setContainer($container);

$app = AppFactory::create();

// Instantiate the logger as a dependency
$container = $app->getContainer();
$container->set('logger', function ($c) {
    $settings = $c->get('settings')['logger'];
    $logger = new Monolog\Logger($settings['name']);
    $logger->pushProcessor(new Monolog\Processor\UidProcessor());
    $logger->pushHandler(
        new Monolog\Handler\StreamHandler(
            __DIR__ . '/logs/app.log',
            \Monolog\Logger::DEBUG
        )
    );
    return $logger;
});

/* Initialize the Stripe client */
$container->set('stripe', function ($c) {
    // For sample support and debugging. Not required for production:
    \Stripe\Stripe::setAppInfo(
      "stripe-samples/subscription-use-cases/fixed-price",
      "0.0.1",
      "https://github.com/stripe-samples/subscription-use-cases/fixed-price"
    );

    $stripe = new \Stripe\StripeClient([
      'api_key' => getenv('STRIPE_SECRET_KEY'),
      'stripe_version' => '2024-09-30.acacia',
    ]);

    return $stripe;
});

$app->get('/', function (Request $request, Response $response, array $args) {
    // Display checkout page
    $response->getBody()->write(file_get_contents(getenv('STATIC_DIR') . '/register.html'));
    return $response;
});

$app->get('/config', function (
    Request $request,
    Response $response,
    array $args
) {
    $stripe = $this->get('stripe');

    $pub_key = getenv('STRIPE_PUBLISHABLE_KEY');

    return $response->withJson([
      'publishableKey' => $pub_key,
    ]);
});

$app->post('/create-customer', function (
    Request $request,
    Response $response,
    array $args
) {
    $body = json_decode($request->getBody());
    $stripe = $this->get('stripe');

    try {
        // Create a new customer object
        $customer = $stripe->customers->create([
            'email' => $body->email,
            'name' => $body->name,
        ]);
        return $response->withJson(['customer' => $customer]);
    } catch (Exception $e) {
        return $response->withStatus(400)->withJson(['error' => ['message' => $e->getError()->message]]);
    }
});

$app->post('/create-meter', function (
    Request $request,
    Response $response,
    array $args
) {
    $body = json_decode($request->getBody());
    $stripe = $this->get('stripe');

    try {
        $meter = $stripe->billing->meters->create([
            'display_name' => $body->displayName,
            'event_name' => $body->eventName,
            'default_aggregation' => [
                'formula' => $body->aggregationFormula
            ]
        ]);
        return $response->withJson(['meter' => $meter]);
    } catch (Exception $e) {
        return $response->withStatus(400)->withJson(['error' => ['message' => $e->getError()->message]]);
    }
});

$app->post('/create-price', function (
    Request $request,
    Response $response,
    array $args
) {
    $body = json_decode($request->getBody());
    $stripe = $this->get('stripe');

    try {
        $price = $stripe->prices->create([
            'currency' => $body->currency,
            'unit_amount' => $body->amount,
            'recurring' => [
                'interval' => 'month',
                'meter' => $body->meterId,
                'usage_type' => 'metered'
            ],
            'product_data' => [
                'name' => $body->productName
            ]
        ]);
        return $response->withJson(['price' => $price]);
    } catch (Exception $e) {
        return $response->withStatus(400)->withJson(['error' => ['message' => $e->getError()->message]]);
    }
});

$app->post('/create-subscription', function (
    Request $request,
    Response $response,
    array $args
) {
    $body = json_decode($request->getBody());
    $stripe = $this->get('stripe');

    try {
        $subscription = $stripe->subscriptions->create([
            'customer' => $body->customerId,
            'items' => [
                ['price' => $body->priceId]
            ],
            'expand' => ['pending_setup_intent']
        ]);
        return $response->withJson(['subscription' => $subscription]);
    } catch (Exception $e) {
        return $response->withStatus(400)->withJson(['error' => ['message' => $e->getError()->message]]);
    }
});

$app->post('/create-meter-event', function (
    Request $request,
    Response $response,
    array $args
) {
    $body = json_decode($request->getBody());
    $stripe = $this->get('stripe');

    try {
        $meterEvent = $stripe->v2->billing->meterEvents->create([
            'event_name' => $body->eventName,
            'payload' => [
                'value' => strval($body->value),
                'stripe_customer_id' => $body->customerId
            ]
        ]);
        return $response->withJson(['meterEvent' => $meterEvent]);
    } catch (Exception $e) {
        return $response->withStatus(400)->withJson(['error' => ['message' => $e->getError()->message]]);
    }
});

$app->post('/webhook', function (Request $request, Response $response) {
    $logger = $this->get('logger');
    $event = $request->getParsedBody();
    $stripe = $this->get('stripe');

    // Parse the message body (and check the signature if possible)
    $webhookSecret = getenv('STRIPE_WEBHOOK_SECRET');
    if ($webhookSecret) {
        try {
            $event = \Stripe\Webhook::constructEvent(
                $request->getBody(),
                $request->getHeaderLine('stripe-signature'),
                $webhookSecret
            );
        } catch (Exception $e) {
            return $response
                ->withJson(['error' => $e->getMessage()])
                ->withStatus(403);
        }
    } else {
        $event = $request->getParsedBody();
    }
    $type = $event['type'];
    $object = $event['data']['object'];

    // Handle the event
    // Review important events for Billing webhooks
    // https://stripe.com/docs/billing/webhooks
    switch ($type) {
        case 'invoice.paid':
          if ($object['billing_reason'] == 'subscription_create') {
            // The subscription automatically activates after successful payment
            // Set the payment method used to pay the first invoice
            // as the default payment method for that subscription
            $subscription_id = $object['subscription'];
            $payment_intent_id = $object['payment_intent'];

            # Retrieve the payment intent used to pay the subscription
            $payment_intent = $stripe->paymentIntents->retrieve(
              $payment_intent_id,
              []
            );

            try {
                $stripe->subscriptions->update(
                    $subscription_id,
                    ['default_payment_method' => $payment_intent->payment_method],
                );

                $logger->info('Default payment method set for subscription:' . $payment_intent->payment_method);
            } catch (Exception $e) {
                $logger->info($e->getMessage());
                $logger->info('️Falied to update the default payment method for subscription: ' . $subscription_id);
            }
          };

          // database to reference when a user accesses your service to avoid hitting rate
          // limits.
          $logger->info('Invoice paid: ' . $event->id);
          break;
        case 'invoice.payment_failed':
            // If the payment fails or the customer does not have a valid payment method,
            // an invoice.payment_failed event is sent, the subscription becomes past_due.
            // Use this webhook to notify your user that their payment has
            // failed and to retrieve new card details.
            $logger->info('Invoice payment failed: ' . $event->id);
            break;
        case 'invoice.finalized':
            // If you want to manually send out invoices to your customers
            // or store them locally to reference to avoid hitting Stripe rate limits.
            $logger->info('Invoice finalized: ' . $event->id);
            break;
        case 'customer.subscription.deleted':
            // handle subscription cancelled automatically based
            // upon your subscription settings. Or if the user
            // cancels it.
            $logger->info('Subscription canceled: ' . $event->id);
            break;
        // ... handle other event types
        default:
        // Unhandled event type
    }

    return $response->withJson(['status' => 'success'])->withStatus(200);
});

$app->run();