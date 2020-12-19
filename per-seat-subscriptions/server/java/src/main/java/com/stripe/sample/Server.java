package com.stripe.sample;

import static spark.Spark.get;
import static spark.Spark.port;
import static spark.Spark.post;
import static spark.Spark.staticFiles;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.annotations.SerializedName;
import com.google.gson.reflect.TypeToken;
import com.stripe.Stripe;
import com.stripe.exception.CardException;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.Invoice;
import com.stripe.model.InvoiceLineItem;
import com.stripe.model.PaymentMethod;
import com.stripe.model.StripeObject;
import com.stripe.model.Subscription;
import com.stripe.model.SubscriptionItem;
import com.stripe.net.Webhook;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.CustomerUpdateParams;
import com.stripe.param.InvoiceCreateParams;
import com.stripe.param.InvoiceRetrieveParams;
import com.stripe.param.InvoiceUpcomingParams;
import com.stripe.param.InvoiceUpcomingParams.Builder;
import com.stripe.param.PaymentMethodAttachParams;
import com.stripe.param.SubscriptionCreateParams;
import com.stripe.param.SubscriptionRetrieveParams;
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

    @SerializedName("quantity")
    Long quantity;

    public String getCustomerId() {
      return customerId;
    }

    public String getPriceId() {
      return priceId;
    }

    public String getPaymentMethodId() {
      return paymentMethodId;
    }

    public Long getQuantity() {
      return quantity;
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

    @SerializedName("quantity")
    Long quantity;

    public String getSubscriptionId() {
      return subscriptionId;
    }

    public String getNewPriceId() {
      return newPriceId;
    }

    public Long getQuantity() {
      return quantity;
    }
  }

  /* Generic Post class if only the subscription id was passed */
  static class SubscriptionPostBody {
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

    @SerializedName("quantity")
    Long quantity;

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

    public Long getQuantity() {
      return quantity;
    }
  }

  public static void main(String[] args) {
    port(4242);
    Dotenv dotenv = Dotenv.load();
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
      "/retrieve-subscription-information",
      (request, response) -> {
        SubscriptionPostBody postBody = gson.fromJson(
          request.body(),
          SubscriptionPostBody.class
        );

        SubscriptionRetrieveParams subParams = SubscriptionRetrieveParams
          .builder()
          .addAllExpand(
            Arrays.asList(
              "latest_invoice",
              "customer.invoice_settings.default_payment_method",
              "items.data.price.product"
            )
          )
          .build();

        Subscription subscription = Subscription.retrieve(
          postBody.getSubscriptionId(),
          subParams,
          null
        );

        InvoiceUpcomingParams invoiceParams = InvoiceUpcomingParams
          .builder()
          .setSubscription(subscription.getId())
          .build();

        Invoice upcomingInvoice = Invoice.upcoming(invoiceParams);

        Map<String, Object> responseData = new HashMap<>();
        responseData.put(
          "card",
          subscription
            .getCustomerObject()
            .getInvoiceSettings()
            .getDefaultPaymentMethodObject()
            .getCard()
        );

        SubscriptionItem item = subscription.getItems().getData().get(0);

        responseData.put(
          "product_description",
          item.getPrice().getProductObject().getName()
        );
        responseData.put(
          "current_price",
          item.getPrice().getId()
        );
        responseData.put(
          "current_quantity",
          item.getQuantity()
        );
        responseData.put(
          "latest_invoice",
          subscription.getLatestInvoiceObject()
        );
        responseData.put("upcoming_invoice", upcomingInvoice);

        // we use StripeObject.PRETTY_PRINT_GSON.toJson() so that we get the JSON our
        // client is expecting on the polymorphic
        // parameters that can either be object ids or the object themselves. If we
        // tried to generate the JSON without call this,
        // for example, by calling gson.toJson(responseData) we will see something like
        // "customer":{"id":"cus_XXX"} instead of
        // "customer":"cus_XXX".
        // If you only need to return 1 object, you can use the built in serializers,
        // i.e. Subscription.retrieve("sub_XXX").toJson()
        return StripeObject.PRETTY_PRINT_GSON.toJson(responseData);
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

        Customer customer = Customer.create(customerParams);

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("customer", customer);
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
          PaymentMethod paymentMethod = PaymentMethod.retrieve(
            postBody.getPaymentMethodId()
          );
          paymentMethod.attach(
            PaymentMethodAttachParams
              .builder()
              .setCustomer(customer.getId())
              .build()
          );

          CustomerUpdateParams customerUpdateParams = CustomerUpdateParams
          .builder()
          .setInvoiceSettings(
            CustomerUpdateParams
              .InvoiceSettings.builder()
              .setDefaultPaymentMethod(paymentMethod.getId())
              .build()
          )
          .build();

          customer.update(customerUpdateParams);

          SubscriptionCreateParams subCreateParams = SubscriptionCreateParams
          .builder()
          .addItem(
            SubscriptionCreateParams
              .Item.builder()
              .setPrice(dotenv.get(postBody.getPriceId().toUpperCase()))
              .setQuantity(postBody.getQuantity())
              .build()
          )
          .setCustomer(customer.getId())
          .addAllExpand(
            Arrays.asList("latest_invoice.payment_intent", "plan.product")
          )
          .build();

          Subscription subscription = Subscription.create(subCreateParams);

          return subscription.toJson();

        } catch (StripeException e) {
          // Since it's a decline, CardException will be caught
          Map<String, String> responseErrorMessage = new HashMap<>();
          responseErrorMessage.put("message", e.getLocalizedMessage());
          Map<String, Object> responseError = new HashMap<>();
          responseError.put("error", responseErrorMessage);
          response.status(400);
          return gson.toJson(responseError);
        }
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
          PaymentMethod paymentMethod = PaymentMethod.retrieve(
            postBody.getPaymentMethodId()
          );
          paymentMethod.attach(
            PaymentMethodAttachParams
              .builder()
              .setCustomer(customer.getId())
              .build()
          );

          CustomerUpdateParams customerUpdateParams = CustomerUpdateParams
            .builder()
            .setInvoiceSettings(
              CustomerUpdateParams
                .InvoiceSettings.builder()
                .setDefaultPaymentMethod(paymentMethod.getId())
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
        } catch (CardException e) {
          // Since it's a decline, CardException will be caught
          Map<String, String> responseErrorMessage = new HashMap<>();
          responseErrorMessage.put("message", e.getLocalizedMessage());
          Map<String, Object> responseError = new HashMap<>();
          responseError.put("error", responseErrorMessage);
          response.status(400);
          return gson.toJson(responseError);
        }
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
        String newPrice = dotenv.get(postBody.getNewPriceId().toUpperCase());
        Long quantity = postBody.getQuantity();

        InvoiceUpcomingParams.Builder invoiceParamsBuilder = new InvoiceUpcomingParams.Builder();
        invoiceParamsBuilder.setCustomer(postBody.getCustomerId());
        String subscriptionId = postBody.getSubscriptionId();
        Subscription subscription = null;

        if (subscriptionId != null) {
          invoiceParamsBuilder.setSubscription(subscriptionId);

          subscription = Subscription.retrieve(subscriptionId);
          String currentPrice = subscription
            .getItems()
            .getData()
            .get(0)
            .getPrice()
            .getId();

          if (currentPrice.equals(newPrice)) {
            invoiceParamsBuilder.addSubscriptionItem(
              InvoiceUpcomingParams
                .SubscriptionItem.builder()
                .setId(subscription.getItems().getData().get(0).getId())
                .setQuantity(quantity)
                .build()
            );
          } else {
            invoiceParamsBuilder.addSubscriptionItem(
              InvoiceUpcomingParams
                .SubscriptionItem.builder()
                .setId(subscription.getItems().getData().get(0).getId())
                .setDeleted(true)
                .build()
            );
            invoiceParamsBuilder.addSubscriptionItem(
              InvoiceUpcomingParams
                .SubscriptionItem.builder()
                .setPrice(newPrice)
                .setQuantity(quantity)
                .build()
            );
          }
        } else {
          invoiceParamsBuilder.addSubscriptionItem(
            InvoiceUpcomingParams
              .SubscriptionItem.builder()
              .setPrice(newPrice)
              .setQuantity(quantity)
              .build()
          );
        }

        Invoice invoice = Invoice.upcoming(invoiceParamsBuilder.build());
        Map<String, Object> responseData = new HashMap<>();

        /*
         * in the case where we are returning the upcoming invoice for a subscription
         * change, calculate what the invoice totals would be for the invoice we'll
         * charge immediately when they confirm the change, and also return the amount
         * for the next period's invoice.
         */
        if (subscription != null) {
          Long currentPeriodEnd = subscription.getCurrentPeriodEnd();
          Long immediateTotal = 0L;
          Long nextInvoiceSum = 0L;

          for (InvoiceLineItem invoiceLineItem : invoice
            .getLines()
            .autoPagingIterable()) {
            if (
              invoiceLineItem.getPeriod().getEnd().equals(currentPeriodEnd)
            ) immediateTotal +=
              invoiceLineItem.getAmount(); else nextInvoiceSum =
              invoiceLineItem.getAmount();
          }
          responseData.put("immediate_total", immediateTotal);
          responseData.put("next_invoice_sum", nextInvoiceSum);
        }

        responseData.put("invoice", invoice);
        return StripeObject.PRETTY_PRINT_GSON.toJson(responseData);
      }
    );

    post(
      "/cancel-subscription",
      (request, response) -> {
        response.type("application/json");
        // Set the default payment method on the customer
        SubscriptionPostBody postBody = gson.fromJson(
          request.body(),
          SubscriptionPostBody.class
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
        String newPrice = dotenv.get(postBody.getNewPriceId().toUpperCase());
        Long quantity = postBody.getQuantity();
        String currentPrice = subscription
          .getItems()
          .getData()
          .get(0)
          .getPrice()
          .getId();

        SubscriptionUpdateParams.Builder updateParamsBuilder = new SubscriptionUpdateParams.Builder();

        if (currentPrice.equals(newPrice)) {
          updateParamsBuilder.addItem(
            SubscriptionUpdateParams
              .Item.builder()
              .setId(subscription.getItems().getData().get(0).getId())
              .setQuantity(quantity)
              .build()
          );
        } else {
          updateParamsBuilder.addItem(
            SubscriptionUpdateParams
              .Item.builder()
              .setId(subscription.getItems().getData().get(0).getId())
              .setDeleted(true)
              .build()
          );

          updateParamsBuilder.addItem(
            SubscriptionUpdateParams
              .Item.builder()
              .setPrice(newPrice)
              .setQuantity(quantity)
              .build()
          );
        }

        subscription =
          subscription.update(
            updateParamsBuilder
              .addAllExpand(Arrays.asList("plan.product"))
              .build()
          );

        String planName = subscription.getPlan().getProductObject().getName();
        Invoice invoice = Invoice.create(
          InvoiceCreateParams
            .builder()
            .setCustomer(subscription.getCustomer())
            .setSubscription(subscription.getId())
            .setDescription(
              "Change to " +
              quantity.toString() +
              " seat(s) on the the " +
              planName +
              " plan"
            )
            .build()
        );

        invoice = invoice.pay();

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("subscription", subscription);
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
