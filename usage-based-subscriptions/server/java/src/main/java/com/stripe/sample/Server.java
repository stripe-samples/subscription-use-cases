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
import com.stripe.model.StripeObject;
import com.stripe.model.Subscription;
import com.stripe.net.Webhook;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.CustomerUpdateParams;
import com.stripe.param.InvoiceCreateParams;
import com.stripe.param.InvoiceRetrieveParams;
import com.stripe.param.InvoiceUpcomingParams;
import com.stripe.param.PaymentMethodAttachParams;
import com.stripe.param.SubscriptionCreateParams;
import com.stripe.param.SubscriptionUpdateParams;
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

  static class CreateSubscriptionBody {
    @SerializedName("customerId")
    String customerId;

    @SerializedName("priceId")
    String priceId;

    @SerializedName("paymentMethodId")
    String paymentMethodId;

    public String getCustomerId() {
      return customerId;
    }

    public String getPriceId() {
      return priceId;
    }

    public String getPaymentMethodId() {
      return paymentMethodId;
    }
  }

  static class PostBody {
    @SerializedName("subscriptionId")
    String subscriptionId;

    @SerializedName("priceId")
    String priceId;

    @SerializedName("newPriceId")
    String newPriceId;

    public String getSubscriptionId() {
      return subscriptionId;
    }

    public String getPriceId() {
      return newPriceId;
    }

    public String getNewPriceId() {
      return newPriceId;
    }
  }

  static class RetryInvoiceBody {
    @SerializedName("invoiceId")
    String invoiceId;

    @SerializedName("paymentMethodId")
    String paymentMethodId;

    @SerializedName("customerId")
    String customerId;

    public String getInvoiceId() {
      return invoiceId;
    }

    public String getPaymentMethodId() {
      return paymentMethodId;
    }

    public String getCustomerId() {
      return customerId;
    }
  }

  static class UpdatePostBody {
    @SerializedName("subscriptionId")
    String subscriptionId;

    @SerializedName("newPriceId")
    String newPriceId;

    public String getSubscriptionId() {
      return subscriptionId;
    }

    public String getNewPriceId() {
      return newPriceId;
    }
  }

  static class CancelPostBody {
    @SerializedName("subscriptionId")
    String subscriptionId;

    public String getSubscriptionId() {
      return subscriptionId;
    }
  }

  static class UpcomingInvoicePostBody {
    @SerializedName("customerId")
    String customerId;

    @SerializedName("subscriptionId")
    String subscriptionId;

    @SerializedName("newPriceId")
    String newPriceId;

    @SerializedName("subscription_trial_end")
    String subscription_trial_end;

    public String getCustomerId() {
      return customerId;
    }

    public String getSubscriptionId() {
      return subscriptionId;
    }

    public String getNewPriceId() {
      return newPriceId;
    }

    public String getSubscriptionTrialEnd() {
      return subscription_trial_end;
    }
  }

  static class PaymentMethodBody {
    @SerializedName("paymentMethodId")
    String paymentMethodId;

    public String getPaymentMethodId() {
      return paymentMethodId;
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
          .build();
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
      }
    );

    post(
      "/create-subscription",
      (request, response) -> {
        response.type("application/json");
        // Set the default payment method on the customer
        CreateSubscriptionBody postBody = gson.fromJson(
          request.body(),
          CreateSubscriptionBody.class
        );
        Customer customer = Customer.retrieve(postBody.getCustomerId());

        try {
          // Set the default payment method on the customer
          PaymentMethod pm = PaymentMethod.retrieve(
            postBody.getPaymentMethodId()
          );
          pm.attach(
            PaymentMethodAttachParams
              .builder()
              .setCustomer(customer.getId())
              .build()
          );
        } catch (CardException e) {
          // Since it's a decline, CardException will be caught
          Map<String, String> responseErrorMessage = new HashMap<>();
          responseErrorMessage.put("message", e.getLocalizedMessage());
          Map<String, Object> responseError = new HashMap<>();
          responseError.put("error", responseErrorMessage);

          return gson.toJson(responseError);
        }

        CustomerUpdateParams customerUpdateParams = CustomerUpdateParams
          .builder()
          .setInvoiceSettings(
            CustomerUpdateParams
              .InvoiceSettings.builder()
              .setDefaultPaymentMethod(postBody.getPaymentMethodId())
              .build()
          )
          .build();

        customer.update(customerUpdateParams);

        // Create the subscription
        SubscriptionCreateParams subCreateParams = SubscriptionCreateParams
          .builder()
          .addItem(
            SubscriptionCreateParams
              .Item.builder()
              .setPrice(dotenv.get(postBody.getPriceId().toUpperCase()))
              .build()
          )
          .setCustomer(customer.getId())
          .addAllExpand(Arrays.asList("latest_invoice.payment_intent", "pending_setup_intent"))
          .build();

        Subscription subscription = Subscription.create(subCreateParams);

        return subscription.toJson();
      }
    );

    post(
      "/retry-invoice",
      (request, response) -> {
        response.type("application/json");
        // Set the default payment method on the customer
        RetryInvoiceBody postBody = gson.fromJson(
          request.body(),
          RetryInvoiceBody.class
        );
        Customer customer = Customer.retrieve(postBody.getCustomerId());

        try {
          // Set the default payment method on the customer
          PaymentMethod pm = PaymentMethod.retrieve(
            postBody.getPaymentMethodId()
          );
          pm.attach(
            PaymentMethodAttachParams
              .builder()
              .setCustomer(customer.getId())
              .build()
          );
        } catch (CardException e) {
          // Since it's a decline, CardException will be caught
          Map<String, String> responseErrorMessage = new HashMap<>();
          responseErrorMessage.put("message", e.getLocalizedMessage());
          Map<String, Object> responseError = new HashMap<>();
          responseError.put("error", responseErrorMessage);
          return gson.toJson(responseError);
        }

        CustomerUpdateParams customerUpdateParams = CustomerUpdateParams
          .builder()
          .setInvoiceSettings(
            CustomerUpdateParams
              .InvoiceSettings.builder()
              .setDefaultPaymentMethod(postBody.getPaymentMethodId())
              .build()
          )
          .build();

        customer.update(customerUpdateParams);

        InvoiceRetrieveParams params = InvoiceRetrieveParams
          .builder()
          .addAllExpand(Arrays.asList("payment_intent"))
          .build();

        Invoice invoice = Invoice.retrieve(
          postBody.getInvoiceId(),
          params,
          null
        );

        return invoice.toJson();
      }
    );

    post(
      "/retrieve-upcoming-invoice",
      (request, response) -> {
        response.type("application/json");
        UpcomingInvoicePostBody postBody = gson.fromJson(
          request.body(),
          UpcomingInvoicePostBody.class
        );

        Subscription subscription = Subscription.retrieve(
          postBody.getSubscriptionId()
        );

        InvoiceUpcomingParams invoiceParams = InvoiceUpcomingParams
          .builder()
          .setCustomer(postBody.getCustomerId())
          .setSubscription(postBody.getSubscriptionId())
          .addSubscriptionItem(
            InvoiceUpcomingParams
              .SubscriptionItem.builder()
              .setId(subscription.getItems().getData().get(0).getId())
              .setDeleted(true)
              .setClearUsage(true)
              .build()
          )
          .addSubscriptionItem(
            InvoiceUpcomingParams
              .SubscriptionItem.builder()
              .setPrice(dotenv.get(postBody.getNewPriceId().toUpperCase()))
              .build()
          )
          .build();

        Invoice invoice = Invoice.upcoming(invoiceParams);

        return invoice.toJson();
      }
    );

    post(
      "/cancel-subscription",
      (request, response) -> {
        response.type("application/json");
        // Set the default payment method on the customer
        CancelPostBody postBody = gson.fromJson(
          request.body(),
          CancelPostBody.class
        );

        Subscription subscription = Subscription.retrieve(
          postBody.getSubscriptionId()
        );

        Subscription deletedSubscription = subscription.cancel();
        return deletedSubscription.toJson();
      }
    );

    post(
      "/update-subscription",
      (request, response) -> {
        response.type("application/json");
        // Set the default payment method on the customer
        UpdatePostBody postBody = gson.fromJson(
          request.body(),
          UpdatePostBody.class
        );

        Subscription subscription = Subscription.retrieve(
          postBody.getSubscriptionId()
        );

        SubscriptionUpdateParams params = SubscriptionUpdateParams
          .builder()
          .addItem(
            SubscriptionUpdateParams
              .Item.builder()
              .setId(subscription.getItems().getData().get(0).getId())
              .setPlan(dotenv.get(postBody.getNewPriceId().toUpperCase()))
              .build()
          )
          .setCancelAtPeriodEnd(false)
          .build();

        subscription.update(params);
        return subscription.toJson();
      }
    );

    post(
      "/retrieve-customer-payment-method",
      (request, response) -> {
        response.type("application/json");
        // Set the default payment method on the customer
        PaymentMethodBody paymentMethodBody = gson.fromJson(
          request.body(),
          PaymentMethodBody.class
        );

        PaymentMethod paymentMethod = PaymentMethod.retrieve(
          paymentMethodBody.getPaymentMethodId()
        );
        return paymentMethod.toJson();
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
