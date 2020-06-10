package com.stripe.sample;

// This code can be run on interval for each active metered subscription
// An example of an interval could be reporting usage once every 24 hours, or even once a minute.

import java.time.Instant;
import java.util.UUID;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.UsageRecord;
import com.stripe.param.UsageRecordCreateOnSubscriptionItemParams;
import com.stripe.net.RequestOptions;

import io.github.cdimascio.dotenv.Dotenv;

public class UsageReporter {
    public static void main(String[] args) {
      // Set your secret key. Remember to switch to your live secret key in production!
      // See your keys here: https://dashboard.stripe.com/account/apikeys
      Dotenv dotenv = Dotenv.load();
      Stripe.apiKey = dotenv.get("STRIPE_SECRET_KEY");

      // Important: your own business logic is needed here before the next step.
      // Here is where to pull a record of a customer from your own database.
      // Extract the customer's Stripe Subscription Item ID and usage for today from your database record in preparation for reporting to Stripe.
      String subscriptionItemID = "";
      // The usage number you've been keeping track of in your own database for the last 24 hours (or the interval you have set for your needs)
      long usageQuantity = 100;

      long timestamp = Instant.now().getEpochSecond();
      // The idempotency key allows you to retry this usage record call if it fails (for example, a network timeout)
      String idempotencyKey = UUID.randomUUID().toString();

      try {
        UsageRecordCreateOnSubscriptionItemParams params =
        UsageRecordCreateOnSubscriptionItemParams.builder()
          .setQuantity(usageQuantity)
          .setTimestamp(timestamp)
          .setAction(UsageRecordCreateOnSubscriptionItemParams.Action.INCREMENT)
          .build();

        RequestOptions options = RequestOptions
          .builder()
          .setIdempotencyKey(idempotencyKey)
          .build();

        UsageRecord.createOnSubscriptionItem(subscriptionItemID, params, options);

      } catch (StripeException e) {
        System.out.println("usage report failed for item ID " + subscriptionItemID + " with idempotency key " + idempotencyKey + ": " + e.getMessage());
      }
    }
}
