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
    if(isset($settings['name'])) {
      $logger = new Monolog\Logger($settings['name']);
      $logger->pushProcessor(new Monolog\Processor\UidProcessor());
      $logger->pushHandler(
          new Monolog\Handler\StreamHandler(
              __DIR__ . '/logs/app.log',
              \Monolog\Logger::DEBUG
          )
      );
      return $logger;
    }
};

/* Initialize the Stripe client */
$container['stripe'] = function ($c) {
    $stripe = new \Stripe\StripeClient(getenv('STRIPE_SECRET_KEY'));
    return $stripe;
};

$app->add(function ($request, $response, $next) {
    return $next($request, $response);
});

$app->get('/', function (Request $request, Response $response, array $args) {
    // Display checkout page
    return $response->write(file_get_contents('../../client/index.html'));
});

$app->get('/config', function (
    Request $request,
    Response $response,
    array $args
) {
    $pub_key = getenv('STRIPE_PUBLISHABLE_KEY');

    return $response->withJson(['publishableKey' => $pub_key]);
});

# Returns information about the subscription and payment method used to display on the account page.
$app->post('/retrieve-subscription-information', function (
    Request $request,
    Response $response,
    array $args
) {
    $body = json_decode($request->getBody());

    $stripe = $this->stripe;

    $subscriptionId = $body->subscriptionId;
    $subscription = $stripe->subscriptions->retrieve($subscriptionId, [
        'expand' => [
            'latest_invoice',
            'customer.invoice_settings.default_payment_method',
            'items.data.price.product',
        ],
    ]);

    $upcomingInvoice = $stripe->invoices->upcoming([
        'subscription' => $subscriptionId,
    ]);

    $item = $subscription->items->data[0];
    return $response->withJson([
        'card' => $subscription->customer->invoice_settings->default_payment_method->card,
        'product_description' => $item->price->product->name,
        'current_price' => $item->price->id,
        'current_quantity' => $item->quantity,
        'latest_invoice' => $subscription->latest_invoice,
        'upcoming_invoice' => $upcomingInvoice,
    ]);
});

$app->post('/create-customer', function (
    Request $request,
    Response $response,
    array $args
) {
    $body = json_decode($request->getBody());

    $stripe = $this->stripe;

    $customer = $stripe->customers->create([
        'email' => $body->email,
    ]);

    return $response->withJson(['customer' => $customer]);
});

# Create a subscription.  This method first attaches the provided payment method to a customer object
# and then creates a subscription for that customer using the supplied price and quantity parameters.
$app->post('/create-subscription', function (
    Request $request,
    Response $response,
    array $args
) {
    $body = json_decode($request->getBody());
    $stripe = $this->stripe;

    try {
        $payment_method = $stripe->paymentMethods->retrieve(
            $body->paymentMethodId
        );
        $payment_method->attach([
            'customer' => $body->customerId,
        ]);

        // Set the default payment method on the customer
        $stripe->customers->update($body->customerId, [
            'invoice_settings' => [
                'default_payment_method' => $payment_method->id,
            ],
        ]);

        // Create the subscription
        $subscription = $stripe->subscriptions->create([
            'customer' => $body->customerId,
            'items' => [
                [
                    'price' => getenv($body->priceId),
                    'quantity' => $body->quantity,
                ],
            ],
            'expand' => ['latest_invoice.payment_intent', 'plan.product'],
        ]);

        return $response->withJson($subscription);
    } catch (Exception $e) {
        return $response->withJson([
            'error' => [
              'message' => $e->getMessage()]
          ])->withStatus(400);
    }
});

$app->post('/retry-invoice', function (
    Request $request,
    Response $response,
    array $args
) {
    $body = json_decode($request->getBody());
    $stripe = $this->stripe;

    try {
        $payment_method = $stripe->paymentMethods->retrieve(
            $body->paymentMethodId
        );
        $payment_method->attach([
            'customer' => $body->customerId,
        ]);

        // Set the default payment method on the customer
        $stripe->customers->update($body->customerId, [
            'invoice_settings' => [
                'default_payment_method' => $payment_method->id,
            ],
        ]);

        $invoice = $stripe->invoices->retrieve($body->invoiceId, [
            'expand' => ['payment_intent'],
        ]);

      return $response->withJson($invoice);
    } catch (Exception $e) {
        return $response->withJson([
            'error' => [
              'message' => $e->getMessage()]
          ])->withStatus(400);
    }
});

$app->post('/retrieve-upcoming-invoice', function (
    Request $request,
    Response $response,
    array $args
) {
    $body = json_decode($request->getBody());
    $stripe = $this->stripe;

    $new_price = getenv(strtoupper($body->newPriceId));
    $params = [];
    $subscription = null;
    $subscriptionId = null;

    $params['customer'] = $body->customerId;
    if(isset($body->subscriptionId)) {
      $subscriptionId = $body->subscriptionId;
    }

    if ($subscriptionId != null) {
        $subscription = $stripe->subscriptions->retrieve($subscriptionId);
        $params['subscription'] = $subscriptionId;

        #compare the current price to the new price, and only create a new subscription if they are different
        #otherwise, just add seats to the existing subscription
        # subscription.plan.id would also work

        $current_price = $subscription->items->data[0]->price->id;

        if ($current_price == $new_price) {
            $params['subscription_items'] = [
                [
                    'id' => $subscription->items->data[0]->id,
                    'quantity' => $body->quantity,
                ],
            ];
        } else {
            $params['subscription_items'] = [
                [
                    'id' => $subscription->items->data[0]->id,
                    'deleted' => true,
                ],
                [
                    'price' => $new_price,
                    'quantity' => $body->quantity,
                ],
            ];
        }
    } else {
        $params['subscription_items'] = [
            [
                'price' => $new_price,
                'quantity' => $body->quantity,
            ],
        ];
    }

    $invoice = $stripe->invoices->upcoming($params);

    #in the case where we are returning the upcoming invoice for a subscription change, calculate what the
    #invoice totals would be for the invoice we'll charge immediately when they confirm the change, and
    #also return the amount for the next period's invoice.

    $responseParams = [];

    if ($subscription != null) {
        $current_period_end = $subscription->current_period_end;
        $immediate_total = 0;
        $next_invoice_sum = 0;

        foreach ($invoice->lines->data as $invoiceLineItem) {
            if ($invoiceLineItem->period->end == $current_period_end) {
                $immediate_total += $invoiceLineItem->amount;
            } else {
                $next_invoice_sum += $invoiceLineItem->amount;
            }
        }

        $responseParams = [
            'immediate_total' => $immediate_total,
            'next_invoice_sum' => $next_invoice_sum,
            'invoice' => $invoice,
        ];
    } else {
        $responseParams = [
            'invoice' => $invoice,
        ];
    }

    return $response->withJson($responseParams);
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

    return $response->withJson($subscription);
});

$app->post('/update-subscription', function (
    Request $request,
    Response $response,
    array $args
) {
    $body = json_decode($request->getBody());

    $stripe = $this->stripe;

    $subscription = $stripe->subscriptions->retrieve($body->subscriptionId);
    $current_price = $subscription->items->data[0]->price->id;
    $new_price = getenv(strtoupper($body->newPriceId));
    $quantity = $body->quantity;

    if ($current_price == $new_price) {
        $this->logger && $this->logger->addInfo('updating quantity of existing item');
        $updatedSubscription = $stripe->subscriptions->update(
            $body->subscriptionId,
            [
                'items' => [
                    [
                        'id' => $subscription->items->data[0]->id,
                        'quantity' => $quantity,
                    ],
                ],
                'expand' => ['plan.product'],
            ]
        );
    } else {
        $updatedSubscription = $stripe->subscriptions->update(
            $body->subscriptionId,
            [
                'items' => [
                    [
                        'id' => $subscription->items->data[0]->id,
                        'deleted' => true,
                    ],
                    [
                        'price' => $new_price,
                        'quantity' => $quantity,
                    ],
                ],
                'expand' => ['plan.product'],
            ]
        );
    }

    #invoice and charge the customer immediately for the payment representing any balance that the customer accrued
    #as a result of the change.  For example, if the user added seats for this month, this would charge the proration amount for those
    # extra seats for the remaining part of the month.

    $invoice = $stripe->invoices->create([
        'customer' => $subscription->customer,
        'subscription' => $subscription->id,
        'description' =>
            'Change to ' .
            $quantity .
            ' seat(s) on the ' .
            $updatedSubscription->plan->product->name .
            ' plan',
    ]);

    $invoice = $invoice->pay();

    return $response->withJson(['subscription' => $updatedSubscription]);
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
        } catch (\Exception $e) {
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
    // Remove comment to see the various objects sent for this sample
    switch ($type) {
        case 'invoice.paid':
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

    return $response->withJson(['status' => 'success'])->withStatus(200);
});

$app->run();
