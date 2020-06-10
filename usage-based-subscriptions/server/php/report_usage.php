<?php
// This code can be run on interval for each active metered subscription
// An example of an interval could be reporting usage once every 24 hours, or even once a minute.

use Stripe\Stripe;
use Ramsey\Uuid\Uuid;
require 'vendor/autoload.php';

$dotenv = Dotenv\Dotenv::create(__DIR__);
$dotenv->load();

// Set your secret key. Remember to switch to your live secret key in production!
// See your keys here: https://dashboard.stripe.com/account/apikeys
Stripe::setApiKey(getenv('STRIPE_SECRET_KEY'));

// Important: your own business logic is needed here before the next step.
// Here is where to pull a record of a customer from your own database.
// Extract the customer's Stripe Subscription Item ID and usage for today from your database record in preparation for reporting to Stripe.
$subscription_item_id = '';
// The usage number you've been keeping track of in your own database for the last 24 hours (or the interval you have set for your needs)
$usage_quantity = 100;

$date = date_create();
$timestamp = date_timestamp_get($date);
// The idempotency key allows you to retry this usage record call if it fails (for example, a network timeout)
$idempotency_key = Uuid::uuid4()->toString();

try {
    \Stripe\SubscriptionItem::createUsageRecord(
        $subscription_item_id,
        [
            'quantity' => $usage_quantity,
            'timestamp' => $timestamp,
        ],
        [
            'idempotency_key' => $idempotency_key,
        ],
    );
} catch (\Stripe\Exception\ApiErrorException $e) {
    echo "usage report failed for item ID $subscription_item_id wuith idempotency key $idempotency_key: $error.toString()";
}
