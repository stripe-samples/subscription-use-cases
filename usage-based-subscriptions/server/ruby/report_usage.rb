# frozen_string_literal: true
# This code can be run on interval for each active metered subscription
# An example of an interval could be reporting usage once every 24 hours, or even once a minute.

require 'stripe'
require 'dotenv'
require 'securerandom'

# Replace if using a different env file or config
Dotenv.load
# Set your secret key. Remember to switch to your live secret key in production!
# See your keys here: https://dashboard.stripe.com/account/apikeys
Stripe.api_key = ENV['STRIPE_SECRET_KEY']


# Important: your own business logic is needed here before the next step.
# Here is where to pull a record of a customer from your own database.
# Extract the customer's Stripe Subscription Item ID and usage for today from your database record in preparation for reporting to Stripe.
subscription_item_id = ''
# The usage number you've been keeping track of in your own database for the last 24 hours (or the interval you have set for your needs)
usage_quantity = 100

timestamp = Time.now.to_i
# The idempotency key allows you to retry this usage record call if it fails (for example, a network timeout)
idempotency_key = SecureRandom.uuid()

begin
  Stripe::SubscriptionItem.create_usage_record(
    subscription_item_id,
    {
      quantity: usage_quantity,
      timestamp: timestamp,
      action: 'increment'
    }, {
      idempotency_key: idempotency_key
    }
  )
rescue Stripe::StripeError => e
  puts "usage report failed for item ID #{subscription_item_id} with idempotency key #{idempotency_key}: #{e.error.message}"
end

