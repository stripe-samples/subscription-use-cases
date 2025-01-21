package com.stripe.sample;

import static spark.Spark.get;
import static spark.Spark.port;
import static spark.Spark.post;

import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;
import com.stripe.Stripe;
import com.stripe.StripeClient;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.*;
import com.stripe.model.billing.Meter;
import com.stripe.model.v2.billing.MeterEvent;
import com.stripe.net.Webhook;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.PriceCreateParams;
import com.stripe.param.SubscriptionCreateParams;

import com.stripe.param.billing.MeterCreateParams;
import com.stripe.param.v2.billing.MeterEventCreateParams;
import io.github.cdimascio.dotenv.Dotenv;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public class Server {
  private static final Gson gson = new Gson();

  static class CreateCustomerBody {
    @SerializedName("name")
    String name;

    @SerializedName("email")
    String email;

    public String getName() {
      return name;
    }

    public String getEmail() {
      return email;
    }
  }

  static class CreateMeterBody {
    @SerializedName("displayName")
    String displayName;

    @SerializedName("eventName")
    String eventName;

    @SerializedName("aggregationFormula")
    String aggregationFormula;

    public String getDisplayName() {
      return displayName;
    }

    public String getEventName() {
      return eventName;
    }

    public MeterCreateParams.DefaultAggregation.Formula getAggregationFormula() {
      if ("sum".equals(aggregationFormula)) {
        return MeterCreateParams.DefaultAggregation.Formula.SUM;
      }
      return MeterCreateParams.DefaultAggregation.Formula.COUNT;
    }
  }

  static class CreatePriceBody {
    @SerializedName("currency")
    String currency;

    @SerializedName("amount")
    Long amount;

    @SerializedName("meterId")
    String meterId;

    @SerializedName("productName")
    String productName;

    public String getCurrency() {
      return currency;
    }

    public Long getAmount() {
      return amount;
    }

    public String getMeterId() {
      return meterId;
    }

    public String getProductName() {
      return productName;
    }
  }

  static class ErrorResponse {
    @SerializedName("error")
    Error error;

    ErrorResponse(Error error) {
      this.error = error;
    }
  }

  static class Error {
    @SerializedName("message")
    String message;

    Error(String message) {
      this.message = message;
    }
  }

  static class CreateSubscriptionBody {
    @SerializedName("customerId")
    String customerId;

    @SerializedName("priceId")
    String priceId;

    public String getCustomerId() {
      return customerId;
    }

    public String getPriceId() {
      return priceId;
    }
  }

  static class CreateMeterEventBody {
    @SerializedName("eventName")
    String eventName;

    @SerializedName("value")
    String value;

    @SerializedName("customerId")
    String customerId;

    public String getEventName() {
      return eventName;
    }

    public String getCustomerId() {
      return customerId;
    }

    public String getValue() {
      return value;
    }
  }

  public static void main(String[] args) {
    port(4242);
    Dotenv dotenv = Dotenv.load();
    // For sample support and debugging, not required for production:
    Stripe.setAppInfo(
        "stripe-samples/subscription-use-cases/usage-based-subscriptions",
        "0.0.1",
        "https://github.com/stripe-samples/subscription-use-cases/usage-based-subscriptions"
    );
    Stripe.apiKey = dotenv.get("STRIPE_SECRET_KEY");

    get(
      "/config",
      (request, response) -> {
        response.type("application/json");
        Map<String, Object> responseData = new HashMap<>();
        responseData.put(
          "publishableKey",
          dotenv.get("STRIPE_PUBLISHABLE_KEY")
        );
        return gson.toJson(responseData);
      }
    );

    post(
      "/create-customer",
      (request, response) -> {
        response.type("application/json");

        CreateCustomerBody postBody = gson.fromJson(
          request.body(),
          CreateCustomerBody.class
        );
        CustomerCreateParams customerParams = CustomerCreateParams
          .builder()
          .setEmail(postBody.getEmail())
          .setName(postBody.getName())
          .build();

        try {
          // Create a new customer object
          Customer customer = Customer.create(customerParams);

          Map<String, Object> responseData = new HashMap<>();
          responseData.put("customer", customer);

          //we use StripeObject.PRETTY_PRINT_GSON.toJson() so that we get the JSON our client is expecting on the polymorphic
          //parameters that can either be object ids or the object themselves. If we tried to generate the JSON without call this,
          //for example, by calling gson.toJson(responseData) we will see something like "customer":{"id":"cus_XXX"} instead of
          //"customer":"cus_XXX".
          //If you only need to return 1 object, you can use the built in serializers, i.e. Subscription.retrieve("sub_XXX").toJson()
          return StripeObject.PRETTY_PRINT_GSON.toJson(responseData);
        } catch (StripeException e) {
          response.status(400);
          return StripeObject.PRETTY_PRINT_GSON.toJson(
            new ErrorResponse(
              new Error(e.getStripeError().getMessage())
            )
          );
        }
      }
    );

    post(
      "/create-meter",
      (request, response) -> {
        response.type("application/json");

        CreateMeterBody postBody = gson.fromJson(
          request.body(),
          CreateMeterBody.class
        );

        MeterCreateParams meterCreateParams = MeterCreateParams.builder()
          .setDisplayName(postBody.getDisplayName())
          .setEventName(postBody.getEventName())
          .setDefaultAggregation(
             MeterCreateParams.DefaultAggregation.builder()
               .setFormula(postBody.getAggregationFormula())
               .build())
          .build();

        try {
          Meter meter = Meter.create(meterCreateParams);
          Map<String, Object> responseData = new HashMap<>();
          responseData.put("meter", meter);
          return StripeObject.PRETTY_PRINT_GSON.toJson(responseData);
        } catch (StripeException e) {
          response.status(400);
          return StripeObject.PRETTY_PRINT_GSON.toJson(
            new ErrorResponse(
              new Error(e.getStripeError().getMessage())
            )
          );
        }
      }
    );

    post("/create-price",(request, response) -> {
      response.type("application/json");

      CreatePriceBody postBody = gson.fromJson(
        request.body(),
        CreatePriceBody.class
      );

      PriceCreateParams priceCreateParams = PriceCreateParams.builder()
        .setCurrency(postBody.getCurrency())
        .setUnitAmount(postBody.getAmount())
        .setRecurring(PriceCreateParams.Recurring.builder()
          .setInterval(PriceCreateParams.Recurring.Interval.MONTH)
          .setMeter(postBody.getMeterId())
          .setUsageType(PriceCreateParams.Recurring.UsageType.METERED)
          .build())
        .setProductData(PriceCreateParams.ProductData.builder()
          .setName(postBody.getProductName())
          .build())
        .build();

      try {
        Price price = Price.create(priceCreateParams);
        Map<String, Object> responseData = new HashMap<>();
        responseData.put("price", price);
        return StripeObject.PRETTY_PRINT_GSON.toJson(responseData);
      } catch (StripeException e) {
        response.status(400);
        return StripeObject.PRETTY_PRINT_GSON.toJson(
          new ErrorResponse(
            new Error(e.getStripeError().getMessage())
          )
        );
      }
    });

    post(
      "/create-subscription",
      (request, response) -> {
        response.type("application/json");
        CreateSubscriptionBody postBody = gson.fromJson(
          request.body(),
          CreateSubscriptionBody.class
        );
        // Create the subscription
        SubscriptionCreateParams subCreateParams = SubscriptionCreateParams
          .builder()
          .addItem(
            SubscriptionCreateParams
              .Item.builder()
              .setPrice(postBody.getPriceId())
              .build()
          )
          .setCustomer(postBody.getCustomerId())
          .addAllExpand(Collections.singletonList("pending_setup_intent"))
          .build();

        try {
          Subscription subscription = Subscription.create(subCreateParams);
          Map<String, Object> responseData = new HashMap<>();
          responseData.put("subscription", subscription);
          return StripeObject.PRETTY_PRINT_GSON.toJson(responseData);
        } catch (StripeException e) {
          response.status(400);
          return StripeObject.PRETTY_PRINT_GSON.toJson(
            new ErrorResponse(
              new Error(e.getStripeError().getMessage())
            )
          );
        }
      }
    );

    post("/create-meter-event",
      (request, response) -> {
        response.type("application/json");

        CreateMeterEventBody postBody = gson.fromJson(
          request.body(),
          CreateMeterEventBody.class
        );

        MeterEventCreateParams meterEventCreateParams = MeterEventCreateParams.builder()
          .setEventName(postBody.getEventName())
          .putPayload("stripe_customer_id", postBody.getCustomerId())
          .putPayload("value", postBody.getValue())
          .build();

        try {
          StripeClient client = new StripeClient(dotenv.get("STRIPE_SECRET_KEY"));
          MeterEvent meterEvent = client.v2().billing().meterEvents().create(meterEventCreateParams);
          Map<String, Object> responseData = new HashMap<>();
          responseData.put("meterEvent", meterEvent);
          return StripeObject.PRETTY_PRINT_GSON.toJson(responseData);
        } catch (StripeException e) {
          response.status(400);
          return StripeObject.PRETTY_PRINT_GSON.toJson(
            new ErrorResponse(
              new Error(e.getStripeError().getMessage())
            )
          );
        }
      });

    post(
      "/webhook",
      (request, response) -> {
        String payload = request.body();
        String sigHeader = request.headers("Stripe-Signature");
        String endpointSecret = dotenv.get("STRIPE_WEBHOOK_SECRET");
        Event event = null;

        try {
          event = Webhook.constructEvent(payload, sigHeader, endpointSecret);
        } catch (SignatureVerificationException e) {
          // Invalid signature
          response.status(400);
          return "";
        }

        // Deserialize the nested object inside the event
        EventDataObjectDeserializer dataObjectDeserializer = event.getDataObjectDeserializer();
        StripeObject stripeObject = null;
        if (dataObjectDeserializer.getObject().isPresent()) {
          stripeObject = dataObjectDeserializer.getObject().get();
        } else {
          // Deserialization failed, probably due to an API version mismatch.
          // Refer to the Javadoc documentation on `EventDataObjectDeserializer` for
          // instructions on how to handle this case, or return an error here.
        }

        switch (event.getType()) {
          case "invoice.paid":
            // Used to provision services after the trial has ended.
            // The status of the invoice will show up as paid. Store the status in your
            // database to reference when a user accesses your service to avoid hitting rate
            // limits.
            break;
          case "invoice.payment_failed":
            // If the payment fails or the customer does not have a valid payment method,
            // an invoice.payment_failed event is sent, the subscription becomes past_due.
            // Use this webhook to notify your user that their payment has
            // failed and to retrieve new card details.
            break;
          case "invoice.finalized":
            // If you want to manually send out invoices to your customers
            // or store them locally to reference to avoid hitting Stripe rate limits.
            break;
          case "customer.subscription.deleted":
            // handle subscription cancelled automatically based
            // upon your subscription settings. Or if the user
            // cancels it.
            break;
          default:
          // Unhandled event type
        }

        response.status(200);
        return "";
      }
    );
  }
}
