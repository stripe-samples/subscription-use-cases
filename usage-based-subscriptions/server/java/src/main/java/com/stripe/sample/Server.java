package com.stripe.sample;

import static spark.Spark.get;
import static spark.Spark.port;
import static spark.Spark.post;
import static spark.Spark.staticFiles;

import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
import com.stripe.param.PaymentMethodAttachParams;
import com.stripe.param.SubscriptionUpdateParams;
import com.stripe.model.Subscription;
import com.stripe.net.Webhook;

import io.github.cdimascio.dotenv.Dotenv;

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
        Stripe.apiKey = dotenv.get("STRIPE_SECRET_KEY");

        staticFiles.externalLocation(
                Paths.get(Paths.get("").toAbsolutePath().toString(), dotenv.get("STATIC_DIR")).normalize().toString());

        get("/config", (request, response) -> {
            response.type("application/json");
            Map<String, Object> responseData = new HashMap<>();
            responseData.put("publishableKey", dotenv.get("STRIPE_PUBLISHABLE_KEY"));
            return gson.toJson(responseData);
        });

        post("/create-customer", (request, response) -> {
            response.type("application/json");

            CreateCustomerBody postBody = gson.fromJson(request.body(), CreateCustomerBody.class);
            // Create a new customer object
            Map<String, Object> customerParams = new HashMap<String, Object>();
            customerParams.put("name", postBody.getName());
            customerParams.put("email", postBody.getEmail());
            Customer customer = Customer.create(customerParams);

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("customer", customer);
            return gson.toJson(responseData);
        });

        post("/create-subscription", (request, response) -> {
            response.type("application/json");
            // Set the default payment method on the customer
            CreateSubscriptionBody postBody = gson.fromJson(request.body(), CreateSubscriptionBody.class);
            Customer customer = Customer.retrieve(postBody.getCustomerId());

            try {
                // Set the default payment method on the customer
                PaymentMethod pm = PaymentMethod.retrieve(postBody.getPaymentMethodId());
                pm.attach(PaymentMethodAttachParams.builder().setCustomer(customer.getId()).build());
            } catch (CardException e) {
                // Since it's a decline, CardException will be caught
                Map<String, String> responseErrorMessage = new HashMap<>();
                responseErrorMessage.put("message", e.getLocalizedMessage());
                Map<String, Object> responseError = new HashMap<>();
                responseError.put("error", responseErrorMessage);

                return gson.toJson(responseError);
            }

            Map<String, Object> customerParams = new HashMap<String, Object>();
            Map<String, String> invoiceSettings = new HashMap<String, String>();
            invoiceSettings.put("default_payment_method", postBody.getPaymentMethodId());
            customerParams.put("invoice_settings", invoiceSettings);
            customer.update(customerParams);

            // Create the subscription
            Map<String, Object> item = new HashMap<>();
            item.put("plan", dotenv.get(postBody.getPriceId().toUpperCase()));
            Map<String, Object> items = new HashMap<>();
            items.put("0", item);
            Map<String, Object> params = new HashMap<>();
            params.put("customer", postBody.getCustomerId());
            params.put("items", items);

            List<String> expandList = new ArrayList<>();
            expandList.add("latest_invoice.payment_intent");
            params.put("expand", expandList);

            Subscription subscription = Subscription.create(params);

            return subscription.toJson();
        });

        post("/retry-invoice", (request, response) -> {
            response.type("application/json");
            // Set the default payment method on the customer
            RetryInvoiceBody postBody = gson.fromJson(request.body(), RetryInvoiceBody.class);
            Customer customer = Customer.retrieve(postBody.getCustomerId());

            try {
                // Set the default payment method on the customer
                PaymentMethod pm = PaymentMethod.retrieve(postBody.getPaymentMethodId());
                pm.attach(PaymentMethodAttachParams.builder().setCustomer(customer.getId()).build());
            } catch (CardException e) {
                // Since it's a decline, CardException will be caught
                Map<String, String> responseErrorMessage = new HashMap<>();
                responseErrorMessage.put("message", e.getLocalizedMessage());
                Map<String, Object> responseError = new HashMap<>();
                responseError.put("error", responseErrorMessage);
                return gson.toJson(responseError);
            }

            Map<String, Object> customerParams = new HashMap<String, Object>();
            Map<String, String> invoiceSettings = new HashMap<String, String>();
            invoiceSettings.put("default_payment_method", postBody.getPaymentMethodId());
            customerParams.put("invoice_settings", invoiceSettings);
            customer.update(customerParams);

            List<String> expandList = new ArrayList<>();
            expandList.add("payment_intent");

            Map<String, Object> params = new HashMap<>();
            params.put("expand", expandList);

            Invoice invoice = Invoice.retrieve(postBody.getInvoiceId(), params, null);

            return invoice.toJson();
        });

        post("/retrieve-upcoming-invoice", (request, response) -> {
            response.type("application/json");
            UpcomingInvoicePostBody postBody = gson.fromJson(request.body(), UpcomingInvoicePostBody.class);

            Subscription subscription = Subscription.retrieve(postBody.getSubscriptionId());

            Map<String, Object> invoiceParams = new HashMap<>();
            invoiceParams.put("customer", postBody.getCustomerId());
            invoiceParams.put("subscription", postBody.getSubscriptionId());
            invoiceParams.put("subscription_prorate", true);
            Map<String, Object> item = new HashMap<>();
            item.put("id", subscription.getItems().getData().get(0).getId());
            item.put("deleted", true);
            item.put("clear_usage", true);
            Map<String, Object> items = new HashMap<>();
            items.put("0", item);
            Map<String, Object> item2 = new HashMap<>();
            item2.put("plan", dotenv.get(postBody.getNewPriceId().toUpperCase()));
            item2.put("deleted", false);
            items.put("1", item2);
            invoiceParams.put("subscription_items", items);

            Invoice invoice = Invoice.upcoming(invoiceParams);

            return invoice.toJson();
        });

        post("/cancel-subscription", (request, response) -> {
            response.type("application/json");
            // Set the default payment method on the customer
            CancelPostBody postBody = gson.fromJson(request.body(), CancelPostBody.class);

            Subscription subscription = Subscription.retrieve(postBody.getSubscriptionId());

            Subscription deletedSubscription = subscription.cancel();
            return deletedSubscription.toJson();
        });

        post("/update-subscription", (request, response) -> {
            response.type("application/json");
            // Set the default payment method on the customer
            UpdatePostBody postBody = gson.fromJson(request.body(), UpdatePostBody.class);

            Subscription subscription = Subscription.retrieve(postBody.getSubscriptionId());

            SubscriptionUpdateParams params = SubscriptionUpdateParams.builder()
                    .addItem(SubscriptionUpdateParams.Item.builder()
                            .setId(subscription.getItems().getData().get(0).getId())
                            .setPlan(dotenv.get(postBody.getNewPriceId().toUpperCase())).build())
                    .setCancelAtPeriodEnd(false).build();

            subscription.update(params);
            return subscription.toJson();
        });

        post("/retrieve-customer-payment-method", (request, response) -> {
            response.type("application/json");
            // Set the default payment method on the customer
            PaymentMethodBody paymentMethodBody = gson.fromJson(request.body(), PaymentMethodBody.class);

            PaymentMethod paymentMethod = PaymentMethod.retrieve(paymentMethodBody.getPaymentMethodId());
            return paymentMethod.toJson();
        });

        post("/stripe-webhook", (request, response) -> {
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
        });
    }
}
