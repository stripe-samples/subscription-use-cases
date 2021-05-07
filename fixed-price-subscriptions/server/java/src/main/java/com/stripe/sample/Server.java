package com.stripe.sample;

import static spark.Spark.get;
import static spark.Spark.port;
import static spark.Spark.post;
import static spark.Spark.staticFiles;

import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;

import com.stripe.Stripe;
import com.stripe.exception.CardException;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Customer;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.Invoice;
import com.stripe.model.PaymentMethod;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Price;
import com.stripe.model.PriceCollection;
import com.stripe.model.StripeObject;
import com.stripe.model.Subscription;
import com.stripe.model.SubscriptionCollection;
import com.stripe.net.Webhook;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.CustomerUpdateParams;
import com.stripe.param.InvoiceCreateParams;
import com.stripe.param.InvoiceRetrieveParams;
import com.stripe.param.InvoiceUpcomingParams;
import com.stripe.param.PaymentMethodAttachParams;
import com.stripe.param.PriceListParams;
import com.stripe.param.SubscriptionCreateParams;
import com.stripe.param.SubscriptionListParams;
import com.stripe.param.SubscriptionUpdateParams;

import io.github.cdimascio.dotenv.Dotenv;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Server {
  private static Gson gson = new Gson();

  static class CreateCustomerRequest {
    @SerializedName("email")
    String email;

    public String getEmail() {
      return email;
    }
  }

  static class CreateSubscriptionRequest {
    @SerializedName("priceId")
    String priceId;

    public String getPriceId() {
      return priceId;
    }
  }

  static class UpdateSubscriptionRequest {
    @SerializedName("subscriptionId")
    String subscriptionId;

    @SerializedName("newPriceLookupKey")
    String newPriceLookupKey;

    public String getSubscriptionId() {
      return subscriptionId;
    }

    public String getNewPriceLookupKey() {
      return newPriceLookupKey;
    }
  }

  static class CancelSubscriptionRequest {
    @SerializedName("subscriptionId")
    String subscriptionId;

    public String getSubscriptionId() {
      return subscriptionId;
    }
  }

  public static void main(String[] args) {
    port(4242);
    Dotenv dotenv = Dotenv.load();

    // For sample support and debugging, not required for production:
    Stripe.setAppInfo(
        "stripe-samples/subscription-use-cases/fixed-price",
        "0.0.1",
        "https://github.com/stripe-samples/subscription-use-cases/fixed-price"
    );
    Stripe.apiKey = dotenv.get("STRIPE_SECRET_KEY");

    staticFiles.externalLocation(
      Paths
        .get(
          Paths.get("").toAbsolutePath().toString(),
          dotenv.get("STATIC_DIR")
        )
        .normalize()
        .toString()
    );

    get(
      "/config",
      (request, response) -> {
        response.type("application/json");
        Map<String, Object> responseData = new HashMap<>();

        responseData.put(
          "publishableKey",
          dotenv.get("STRIPE_PUBLISHABLE_KEY")
        );

        PriceListParams params = PriceListParams
          .builder()
          .addLookupKeys("sample_basic")
          .addLookupKeys("sample_premium")
          .build();
        PriceCollection prices = Price.list(params);
        responseData.put("prices", prices.getData());

        return gson.toJson(responseData);
      }
    );

    post(
      "/create-customer",
      (request, response) -> {
        response.type("application/json");

        // Deserialize request from our front end.
        CreateCustomerRequest postBody = gson.fromJson(
          request.body(),
          CreateCustomerRequest.class
        );

        // Construct params for creating a customer.
        CustomerCreateParams customerParams = CustomerCreateParams
          .builder()
          .setEmail(postBody.getEmail())
          .build();

        // Create a new customer object.
        Customer customer = Customer.create(customerParams);

        // Set a cookie to simulate authentication. In practice, you
        // should store the ID of the customer alongside your user
        // objects so that you can easily find the Stripe Customer ID
        // for a given user.
        response.cookie("/", "customer", customer.getId(), 3600, false, true);

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("customer", customer);

        // Use StripeObject.PRETTY_PRINT_GSON.toJson() to get the
        // JSON our front end is expecting on the polymorphic parameters that can
        // either be object ids or the object themselves. If we tried to
        // generate the JSON without call this, for example, by calling
        // gson.toJson(responseData) we will see something like
        // "customer":{"id":"cus_XXX"} instead of "customer":"cus_XXX".  If you
        // only need to return 1 object, you can use the built in serializers,
        // i.e. Subscription.retrieve("sub_XXX").toJson()
        return StripeObject.PRETTY_PRINT_GSON.toJson(responseData);
      }
    );

    post(
      "/create-subscription",
      (request, response) -> {
        response.type("application/json");

        // Fetch the Stripe Customer ID from the request. This is to
        // simulate authentication. In practice, this ID should live
        // alongside your user in the database and here you would lookup
        // the authenticated user and query for their Stripe customer ID.
        String customerId = request.cookie("customer");

        CreateSubscriptionRequest postBody = gson.fromJson(
          request.body(),
          CreateSubscriptionRequest.class
        );

        // This is the ID of the Stripe Price object. In the sample, this
        // is stored in enviornment variables using the .env file.
        // The lookup key like `basic` or `premium` is passed from
        // the front end, then the price ID like price_ab3b23b2321bb46 is
        // looked up in the environment variables.
        String priceId = postBody.getPriceId();

        // Create the subscription
        SubscriptionCreateParams subCreateParams = SubscriptionCreateParams
          .builder()
          .setCustomer(customerId)
          .addItem(
            SubscriptionCreateParams
              .Item.builder()
              .setPrice(priceId)
              .build()
          )
          .setPaymentBehavior(SubscriptionCreateParams.PaymentBehavior.DEFAULT_INCOMPLETE)
          .addAllExpand(Arrays.asList("latest_invoice.payment_intent"))
          .build();

        Subscription subscription = Subscription.create(subCreateParams);

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("subscriptionId", subscription.getId());
        responseData.put("clientSecret", subscription.getLatestInvoiceObject().getPaymentIntentObject().getClientSecret());
        return StripeObject.PRETTY_PRINT_GSON.toJson(responseData);
      }
    );

    get(
      "/invoice-preview",
      (request, response) -> {
        response.type("application/json");

        // Fetch the Stripe Customer ID from the request. This is to
        // simulate authentication. In practice, this ID should live
        // alongside your user in the database and here you would lookup
        // the authenticated user and query for their Stripe customer ID.
        String customerId = request.cookie("customer");

        // The ID of the Price to use when previewing a potential
        // change to the subscription. This is passed in the query
        // string params as `basic` or `premium`, then retrieved
        // from the environment variables.
        String newPriceId = dotenv.get(request.queryParams("newPriceLookupKey").toUpperCase());

        // Fetch the subscription, so that we can retrieve the related
        // subscription item's ID that we're updating. In practice, you
        // might want to store the ID of the subscription items so you
        // don't need this API call to retrieve ths Subscription.
        String subscriptionId = request.queryParams("subscriptionId");
        Subscription subscription = Subscription.retrieve(subscriptionId);

        // Build the params for retrieving the invoice preview.
        InvoiceUpcomingParams invoiceParams = InvoiceUpcomingParams
          .builder()
          .setCustomer(customerId)
          .setSubscription(subscriptionId)
          .addSubscriptionItem(
            InvoiceUpcomingParams
              .SubscriptionItem.builder()
              .setId(subscription.getItems().getData().get(0).getId())
              .setPrice(newPriceId)
              .build()
          )
          .build();

        // Fetch the invoice preview.
        Invoice invoice = Invoice.upcoming(invoiceParams);

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("invoice", invoice);
        return StripeObject.PRETTY_PRINT_GSON.toJson(responseData);
      }
    );

    post(
      "/cancel-subscription",
      (request, response) -> {
        response.type("application/json");

        CancelSubscriptionRequest postBody = gson.fromJson(
          request.body(),
          CancelSubscriptionRequest.class
        );

        Subscription subscription = Subscription.retrieve(
          postBody.getSubscriptionId()
        );

        Subscription deletedSubscription = subscription.cancel();

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("subscription", deletedSubscription);
        return StripeObject.PRETTY_PRINT_GSON.toJson(responseData);
      }
    );

    post(
      "/update-subscription",
      (request, response) -> {
        response.type("application/json");

        // Set the default payment method on the customer
        UpdateSubscriptionRequest postBody = gson.fromJson(
          request.body(),
          UpdateSubscriptionRequest.class
        );

        // The ID of the price the subscription will be upgraded or downgraded to.
        String newPriceId = dotenv.get(postBody.getNewPriceLookupKey().toUpperCase());

        // Retrieve the subscription to access related subscription item ID
        // to update.
        Subscription subscription = Subscription.retrieve(
          postBody.getSubscriptionId()
        );

        // Build params to update the Subscription.
        SubscriptionUpdateParams params = SubscriptionUpdateParams
          .builder()
          .addItem(
            SubscriptionUpdateParams
              .Item.builder()
              .setId(subscription.getItems().getData().get(0).getId())
              .setPrice(newPriceId)
              .build()
          )
          .setCancelAtPeriodEnd(false)
          .build();

        // update the subscription.
        subscription.update(params);

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("subscription", subscription);
        return StripeObject.PRETTY_PRINT_GSON.toJson(responseData);
      }
    );

    get(
      "/subscriptions",
      (request, response) -> {
        response.type("application/json");

        // Fetch the Stripe Customer ID from the request. This is to
        // simulate authentication. In practice, this ID should live
        // alongside your user in the database and here you would lookup
        // the authenticated user and query for their Stripe customer ID.
        String customerId = request.cookie("customer");

        SubscriptionListParams params = SubscriptionListParams
            .builder()
            .setStatus(SubscriptionListParams.Status.ALL)
            .setCustomer(customerId)
            .addAllExpand(Arrays.asList("data.default_payment_method"))
            .build();

        SubscriptionCollection subscriptions = Subscription.list(params);
        Map<String, Object> responseData = new HashMap<>();
        responseData.put("subscriptions", subscriptions);
        return StripeObject.PRETTY_PRINT_GSON.toJson(responseData);
      }
    );

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
          case "invoice.payment_succeeded":
            Invoice invoice = (Invoice) stripeObject;
            if(invoice.getBillingReason().equals("subscription_create")) {
              // The subscription automatically activates after successful payment
              // Set the payment method used to pay the first invoice
              // as the default payment method for that subscription
              String subscriptionId = invoice.getSubscription();
              String paymentIntentId = invoice.getPaymentIntent();

              // Retrieve the payment intent used to pay the subscription
              PaymentIntent paymentIntent = PaymentIntent.retrieve(paymentIntentId);

              // Set the default payment method
              Subscription subscription = Subscription.retrieve(subscriptionId);
              SubscriptionUpdateParams params = SubscriptionUpdateParams
                .builder()
                .setDefaultPaymentMethod(paymentIntent.getPaymentMethod())
                .build();
              Subscription updatedSubscription = subscription.update(params);
              System.out.println("Default payment method set for subscription: " + paymentIntent.getPaymentMethod());
            }

            System.out.println("Payment succeeded for invoice: " + event.getId());

            break;
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
