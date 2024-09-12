package com.stripe.sample;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.UsageRecord;
import com.stripe.net.RequestOptions;
import com.stripe.param.UsageRecordCreateOnSubscriptionItemParams;
import io.github.cdimascio.dotenv.Dotenv;
// This code can be run on an interval (e.g., every 24 hours) for each active
// metered subscription.

import java.time.Instant;
import java.util.UUID;

public class ReportUsage {

  public static void main(String[] args) {
    // Set your secret key. Remember to switch to your live secret key in production!
    // See your keys here: https://dashboard.stripe.com/account/apikeys
    Dotenv dotenv = Dotenv.load();
    Stripe.apiKey = dotenv.get("STRIPE_SECRET_KEY");

    // You need to write some of your own business logic before creating the
    // usage record. Pull a record of a customer from your database
    // and extract the customer's Stripe Subscription Item ID and
    // usage for the day. If you aren't storing subscription item IDs,
    // you can retrieve the subscription and check for subscription items
    // https://stripe.com/docs/api/subscriptions/object#subscription_object-items.
    String subscriptionItemID = "";
    // The usage number you've been keeping track of in your own database for the last 24 hours.
    long usageQuantity = 100;

    long timestamp = Instant.now().getEpochSecond();
    // The idempotency key allows you to retry this usage record call if it fails.
    String idempotencyKey = UUID.randomUUID().toString();

    try {
      UsageRecordCreateOnSubscriptionItemParams params = UsageRecordCreateOnSubscriptionItemParams
        .builder()
        .setQuantity(usageQuantity)
        .setTimestamp(timestamp)
        .setAction(UsageRecordCreateOnSubscriptionItemParams.Action.SET)
        .build();

      RequestOptions options = RequestOptions
        .builder()
        .setIdempotencyKey(idempotencyKey)
        .build();

      UsageRecord.createOnSubscriptionItem(subscriptionItemID, params, options);
    } catch (StripeException e) {
      System.out.println(
        "Usage report failed for item ID " +
        subscriptionItemID +
        " with idempotency key " +
        idempotencyKey +
        ": " +
        e.getMessage()
      );
    }
  }
}
