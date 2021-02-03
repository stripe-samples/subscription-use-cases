<?php
use Slim\Http\Request;
use Slim\Http\Response;
use Stripe\Stripe;
require 'vendor/autoload.php';

$dotenv = Dotenv\Dotenv::create(__DIR__);
$dotenv->load();

require './config.php';

$app = new \Slim\App();

// Instantiate the logger as a dependency
$container = $app->getContainer();
$container['logger'] = function ($c) {
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
};

/* Initialize the Stripe client */
$container['stripe'] = function ($c) {
    $stripe = new \Stripe\StripeClient(getenv('STRIPE_SECRET_KEY'));
    return $stripe;
};

$app->get('/', function (Request $request, Response $response, array $args) {
    // Display checkout page
    return $response->write(file_get_contents(getenv('STATIC_DIR') . '/register.html'));
});

$app->get('/config', function (
    Request $request,
    Response $response,
    array $args
) {
    $pub_key = getenv('STRIPE_PUBLISHABLE_KEY');

    return $response->withJson(['publishableKey' => $pub_key]);
});

$app->post('/create-customer', function (
    Request $request,
    Response $response,
    array $args
) {
    $body = json_decode($request->getBody());
    $stripe = $this->stripe;

    // Create a new customer object
    $customer = $stripe->customers->create([
        'email' => $body->email,
    ]);

    // Set a cookie for the customer to simulate authentication.
    // In practice, store the Stripe Customer ID ($customer->id)
    // in your database along side your user data.
    setcookie('customer', $customer->id, time()+60*60*24);

    return $response->withJson(['customer' => $customer]);
});

$app->post('/create-subscription', function (
    Request $request,
    Response $response,
    array $args
) {
    $body = json_decode($request->getBody());
    $stripe = $this->stripe;

    # Simulates an authenticated user. In practice, you'll
    # use the Stripe Customer ID of the authenticated user.
    $customer_id = $_COOKIE['customer'];

    # The ID of a Price object in your Stripe account. In this
    # sample, it's stored in the .env file and loaded from environment
    # variables.
    $price_id = getenv(strtoupper($body->priceLookupKey));

    # Attach the newly created payment method to the customer.
    try {
        $payment_method = $stripe->paymentMethods->retrieve(
            $body->paymentMethodId
        );
        $payment_method->attach([
            'customer' => $customer_id,
        ]);
    } catch (\Stripe\Exception\CardException $e) {
      return $response->withJson([
        'error' => [
          'message' => $e->getError()->message,
        ]
      ], 400);
    }

    // Create the subscription.
    $subscription = $stripe->subscriptions->create([
        'customer' => $customer_id,
        'default_payment_method' => $payment_method->id,
        'items' => [[
            'price' => $price_id,
        ]],
        'expand' => ['latest_invoice.payment_intent'],
    ]);

    return $response->withJson(['subscription' => $subscription]);
});

$app->get('/invoice-preview', function (
    Request $request,
    Response $response,
    array $args
) {
    $stripe = $this->stripe;
    $customer_id = $_COOKIE['customer'];
    $subscription_id = $request->getQueryParam('subscriptionId');
    $new_price_lookup_key = strtoupper($request->getQueryParam('newPriceLookupKey'));
    $subscription = $stripe->subscriptions->retrieve($subscription_id);

    $invoice = $stripe->invoices->upcoming([
        'customer' => $customer_id,
        'subscription' => $subscription_id,
        'subscription_items' => [[
            'id' => $subscription->items->data[0]->id,
            'price' => getenv($new_price_lookup_key),
        ]],
    ]);

    return $response->withJson(['invoice' => $invoice]);
});

$app->post('/cancel-subscription', function (
    Request $request,
    Response $response,
    array $args
) {
    $body = json_decode($request->getBody());
    $stripe = $this->stripe;

    $subscription = $stripe->subscriptions->retrieve($body->subscriptionId);
    $subscription->delete();

    return $response->withJson(['subscription' => $subscription]);
});

$app->post('/update-subscription', function (
    Request $request,
    Response $response,
    array $args
) {
    $body = json_decode($request->getBody());
    $stripe = $this->stripe;
    $new_price_id = getenv(strtoupper($body->newPriceLookupKey));

    $subscription = $stripe->subscriptions->retrieve($body->subscriptionId);

    $updatedSubscription = $stripe->subscriptions->update(
        $body->subscriptionId, [
            'items' => [[
                'id' => $subscription->items->data[0]->id,
                'price' => $new_price_id,
            ]],
        ]
    );

    return $response->withJson(['subscription' => $updatedSubscription]);
});

$app->get('/subscriptions', function(
    Request $request,
    Response $response,
    array $args
) {
    $stripe = $this->stripe;
    # Simulates an authenticated user. In practice, you'll
    # use the Stripe Customer ID of the authenticated user.
    $customer_id = $_COOKIE['customer'];

    $subscriptions = $stripe->subscriptions->all([
        'customer' => $customer_id,
        'status' => 'all',
        'expand' => ['data.default_payment_method'],
    ]);

    return $response->withJson(['subscriptions' => $subscriptions]);
});

$app->post('/webhook', function (Request $request, Response $response) {
    $logger = $this->get('logger');
    $event = $request->getParsedBody();
    $stripe = $this->stripe;

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
            // The status of the invoice will show up as paid. Store the status in your
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
