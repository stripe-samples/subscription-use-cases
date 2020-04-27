package com.stripe.sample;

import static spark.Spark.get;
import static spark.Spark.port;
import static spark.Spark.post;
import static spark.Spark.staticFiles;

import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Customer;
import com.stripe.model.Plan;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.Invoice;
import com.stripe.model.PaymentMethod;
import com.stripe.model.StripeObject;
import com.stripe.model.SetupIntent;
import com.stripe.param.SetupIntentCreateParams;
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

        @SerializedName("planId")
        String planId;

        @SerializedName("paymentMethodId")
        String paymentMethodId;

        public String getCustomerId() {
            return customerId;
        }

        public String getPlanId() {
            return planId;
        }

        public String getPaymentMethodId() {
            return paymentMethodId;
        }
    }

    static class PostBody {
        @SerializedName("subscriptionId")
        String subscriptionId;

        @SerializedName("planId")
        String planId;

        @SerializedName("newPlanId")
        String newPlanId;

        public String getSubscriptionId() {
            return subscriptionId;
        }

        public String getPlanId() {
            return newPlanId;
        }

        public String getNewPlanId() {
            return newPlanId;
        }
    }

    static class UpdatePostBody {
        @SerializedName("subscriptionId")
        String subscriptionId;

        @SerializedName("newPlanId")
        String newPlanId;

        public String getSubscriptionId() {
            return subscriptionId;
        }

        public String getNewPlanId() {
            return newPlanId;
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

        @SerializedName("newPlanId")
        String newPlanId;

        @SerializedName("subscription_trial_end")
        String subscription_trial_end;

        public String getCustomerId() {
            return customerId;
        }

        public String getSubscriptionId() {
            return subscriptionId;
        }

        public String getNewPlanId() {
            return newPlanId;
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

            // Create a SetupIntent to set up our payment methods recurring usage
            SetupIntentCreateParams setupIntentParams = new SetupIntentCreateParams.Builder()
                    .addPaymentMethodType("card").addPaymentMethodType("au_becs_debit").setCustomer(customer.getId())
                    .build();
            SetupIntent setupIntent = SetupIntent.create(setupIntentParams);

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("customer", customer);
            responseData.put("setupIntent", setupIntent);
            return gson.toJson(responseData);
        });

        post("/create-subscription", (request, response) -> {
            response.type("application/json");
            // Set the default payment method on the customer
            CreateSubscriptionBody postBody = gson.fromJson(request.body(), CreateSubscriptionBody.class);
            Customer customer = Customer.retrieve(postBody.getCustomerId());

            Map<String, Object> customerParams = new HashMap<String, Object>();
            Map<String, String> invoiceSettings = new HashMap<String, String>();
            invoiceSettings.put("default_payment_method", postBody.getPaymentMethodId());
            customerParams.put("invoice_settings", invoiceSettings);
            customer.update(customerParams);

            // Create the subscription
            Map<String, Object> item = new HashMap<>();
            item.put("plan", dotenv.get(postBody.getPlanId().toUpperCase()));
            Map<String, Object> items = new HashMap<>();
            items.put("0", item);
            Map<String, Object> params = new HashMap<>();
            params.put("customer", postBody.getCustomerId());
            params.put("trial_from_plan", true);
            params.put("items", items);
            Subscription subscription = Subscription.create(params);

            return subscription.toJson();
        });

        post("/retrieve-upcoming-invoice", (request, response) -> {
            response.type("application/json");
            UpcomingInvoicePostBody postBody = gson.fromJson(request.body(), UpcomingInvoicePostBody.class);

            Subscription subscription = Subscription.retrieve(postBody.getSubscriptionId());

            Map<String, Object> invoiceParams = new HashMap<>();
            invoiceParams.put("customer", postBody.getCustomerId());
            invoiceParams.put("subscription", postBody.getSubscriptionId());
            invoiceParams.put("subscription_trial_end", postBody.getSubscriptionTrialEnd());
            invoiceParams.put("subscription_prorate", true);
            Map<String, Object> item = new HashMap<>();
            item.put("id", subscription.getItems().getData().get(0).getId());
            item.put("deleted", true);
            Map<String, Object> items = new HashMap<>();
            items.put("0", item);
            Map<String, Object> item2 = new HashMap<>();
            item2.put("plan", dotenv.get(postBody.getNewPlanId().toUpperCase()));
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
                            .setPlan(dotenv.get(postBody.getNewPlanId().toUpperCase())).build())
                    .setCancelAtPeriodEnd(false).build();

            subscription.update(params);
            return subscription.toJson();
        });

        post("/retrieve-customer-paymentMethod", (request, response) -> {
            response.type("application/json");
            // Set the default payment method on the customer
            PaymentMethodBody paymentMethodBody = gson.fromJson(request.body(), PaymentMethodBody.class);

            PaymentMethod paymentMethod = PaymentMethod.retrieve(paymentMethodBody.getPaymentMethodId());
            return paymentMethod.toJson();
        });

        post("/webhook", (request, response) -> {
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
                case "customer.subscription.trial_will_end":
                    // Send notification to your user that the trial will end
                    break;
                default:
                    // Unhandled event type
            }

            response.status(200);
            return "";
        });
    }
}