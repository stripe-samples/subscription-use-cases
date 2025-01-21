# frozen_string_literal: true
# This code can be run on an interval (e.g., every 24 hours) for each active
# metered subscription.

require 'stripe'
require 'dotenv'
require 'securerandom'

# Replace if using a different env file or config
Dotenv.load
# Set your secret key. Remember to switch to your live secret key in production!
# See your keys here: https://dashboard.stripe.com/account/apikeys
Stripe.api_key = ENV['STRIPE_SECRET_KEY']

# You need to write some of your own business logic before creating the
# usage record. Pull a record of a customer from your database
# and extract the customer's Stripe Subscription Item ID and usage for
# the day. If you aren't storing subscription item IDs,
# you can retrieve the subscription and check for subscription items
# https://stripe.com/docs/api/subscriptions/object#subscription_object-items.
subscription_item_id = ''
# The usage number you've been keeping track of in your database for
# the last 24 hours.
usage_quantity = 100

timestamp = Time.now.to_i
# The idempotency key allows you to retry this usage record call if it fails.
idempotency_key = SecureRandom.uuid

begin
  Stripe::SubscriptionItem.create_usage_record(
    subscription_item_id,
    { quantity: usage_quantity, timestamp: timestamp, action: 'set' },
    { idempotency_key: idempotency_key }
  )
rescue Stripe::StripeError => e
  puts "Usage report failed for item ID #{
         subscription_item_id
       } with idempotency key #{idempotency_key}: #{e.error.message}"
end
