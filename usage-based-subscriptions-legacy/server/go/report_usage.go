package main

import (
  "github.com/stripe/stripe-go"
  "github.com/stripe/stripe-go/usagerecord"
)

func main() {
  // Set your secret key. Remember to switch to your live secret key in production!
  // See your keys here: https://dashboard.stripe.com/account/apikeys
	stripe.Key = os.Getenv("{{STRIPE_SECRET_KEY}}")

  // This code can be run on an interval (e.g., every 24 hours) for each active
  // metered subscription.

  // You need to write some of your own business logic before creating the
  // usage record. Pull a record of a customer from your database
  // and extract the customer's Stripe Subscription Item ID and
  // usage for the day. If you aren't storing subscription item IDs,
  // you can retrieve the subscription and check for subscription items
  // https://stripe.com/docs/api/subscriptions/object#subscription_object-items.
  var subscriptionItemId = "{{SUBSCRIPTION_ITEM_ID}}"

  // The usage number you've been keeping track of in your database for the last 24 hours.
  usageQuantity := int64(100)

  params := &stripe.UsageRecordParams{
    SubscriptionItem: stripe.String(subscriptionItemId),
    Quantity: stripe.Int64(usageQuantity),
    Timestamp: stripe.Int64(time.Now().Unix()),
    Action: stripe.String(string(stripe.UsageRecordActionSet)),
  }

  usagerecord.New(params)
}
