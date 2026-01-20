using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Stripe;

// For more information on enabling MVC for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace dotnet.Controllers
{
    public class BillingController : Controller
    {
        private readonly IOptions<StripeOptions> options;

        public BillingController(IOptions<StripeOptions> options)
        {
            this.options = options;
            StripeConfiguration.ApiKey = options.Value.SecretKey;
        }

        [HttpGet("config")]
        public ActionResult<ConfigResponse> GetConfig()
        {

            var options = new PriceListOptions
            {
              LookupKeys = new List<string>
              {
                "sample_basic",
                "sample_premium"
              }
            };
            var service = new PriceService();
            var prices = service.List(options);

            return new ConfigResponse
            {
                PublishableKey = this.options.Value.PublishableKey,
                Prices = prices.Data
            };
        }

        [HttpPost("create-customer")]
        public ActionResult<CreateCustomerResponse> CreateCustomer([FromBody] CreateCustomerRequest req)
        {
            var options = new CustomerCreateOptions
            {
                Email = req.Email,
            };
            var service = new CustomerService();
            var customer = service.Create(options);

            // Set the cookie to simulate an authenticated user.
            // In practice, this customer.Id is stored along side your
            // user and retrieved along with the logged in user.
            HttpContext.Response.Cookies.Append("customer", customer.Id);

            return new CreateCustomerResponse
            {
                Customer = customer,
            };
        }

        [HttpPost("create-subscription")]
        public ActionResult<SubscriptionCreateResponse> CreateSubscription([FromBody] CreateSubscriptionRequest req)
        {
            var customerId = HttpContext.Request.Cookies["customer"];

            // Create subscription
            var subscriptionOptions = new SubscriptionCreateOptions
            {
                Customer = customerId,
                Items = new List<SubscriptionItemOptions>
                {
                    new SubscriptionItemOptions
                    {
                        Price = req.PriceId,
                    },
                },
                PaymentBehavior = "default_incomplete",
            };
            subscriptionOptions.AddExpand("latest_invoice.payments.data.payment");
            var subscriptionService = new SubscriptionService();
            try
            {
                Subscription subscription = subscriptionService.Create(subscriptionOptions);

                // Get the payment intent ID and retrieve the full PaymentIntent separately
                var paymentIntentId = subscription.LatestInvoice.Payments.Data[0].Payment.PaymentIntentId;
                var paymentIntentService = new PaymentIntentService();
                var paymentIntent = paymentIntentService.Get(paymentIntentId);

                return new SubscriptionCreateResponse
                {
                  SubscriptionId = subscription.Id,
                  ClientSecret = paymentIntent.ClientSecret,
                };
            }
            catch (StripeException e)
            {
                Console.WriteLine($"Failed to create subscription.{e}");
                return BadRequest();
            }
        }

        [HttpGet("invoice-preview")]
        public ActionResult<InvoiceResponse> InvoicePreview(string subscriptionId, string newPriceLookupKey)
        {
            var customerId = HttpContext.Request.Cookies["customer"];
            var service = new SubscriptionService();
            var subscription = service.Get(subscriptionId);

            var invoiceService = new InvoiceService();
            var options = new InvoiceCreatePreviewOptions
            {
                Customer = customerId,
                Subscription = subscriptionId,
                SubscriptionDetails = new InvoiceSubscriptionDetailsOptions
                {
                    Items = new List<InvoiceSubscriptionDetailsItemOptions>
                    {
                        new InvoiceSubscriptionDetailsItemOptions
                        {
                            Id = subscription.Items.Data[0].Id,
                            Price = Environment.GetEnvironmentVariable(newPriceLookupKey.ToUpper()),
                        },
                    }
                }
            };
            Invoice upcoming = invoiceService.CreatePreview(options);
            return new InvoiceResponse{
              Invoice = upcoming,
            };
        }

        [HttpPost("cancel-subscription")]
        public ActionResult<SubscriptionResponse> CancelSubscription([FromBody] CancelSubscriptionRequest req)
        {
            var service = new SubscriptionService();
            var subscription = service.Cancel(req.Subscription, null);
            return new SubscriptionResponse
            {
              Subscription = subscription,
            };
        }

        [HttpPost("update-subscription")]
        public ActionResult<SubscriptionResponse> UpdateSubscription([FromBody] UpdateSubscriptionRequest req)
        {
            var service = new SubscriptionService();
            var subscription = service.Get(req.Subscription);

            var options = new SubscriptionUpdateOptions
            {
                CancelAtPeriodEnd = false,
                Items = new List<SubscriptionItemOptions>
                {
                    new SubscriptionItemOptions
                    {
                        Id = subscription.Items.Data[0].Id,
                        Price = Environment.GetEnvironmentVariable(req.NewPrice.ToUpper()),
                    }
                }
            };
            var updatedSubscription = service.Update(req.Subscription, options);
            return new SubscriptionResponse
            {
              Subscription = updatedSubscription,
            };
        }

        [HttpGet("subscriptions")]
        public ActionResult<SubscriptionsResponse> ListSubscriptions()
        {
            var customerId = HttpContext.Request.Cookies["customer"];
            var options = new SubscriptionListOptions
            {
                Customer = customerId,
                Status = "all",
            };
            options.AddExpand("data.default_payment_method");
            var service = new SubscriptionService();
            var subscriptions = service.List(options);

            return new SubscriptionsResponse{
              Subscriptions = subscriptions,
            };
        }


        [HttpPost("webhook")]
        public async Task<IActionResult> Webhook()
        {
            var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
            Event stripeEvent;
            try
            {
                stripeEvent = EventUtility.ConstructEvent(
                    json,
                    Request.Headers["Stripe-Signature"],
                    this.options.Value.WebhookSecret
                );
                Console.WriteLine($"Webhook notification with type: {stripeEvent.Type} found for {stripeEvent.Id}");
            }
            catch (Exception e)
            {
                Console.WriteLine($"Something failed {e}");
                return BadRequest();
            }

            if (stripeEvent.Type == "invoice.payment_succeeded") {
              var invoice = stripeEvent.Data.Object as Invoice;

              if(invoice.BillingReason == "subscription_create") {
                // The subscription automatically activates after successful payment
                // Set the payment method used to pay the first invoice
                // as the default payment method for that subscription

                // Get payment intent ID from the payments collection
                if (invoice.Payments?.Data?.Count > 0 && invoice.Payments.Data[0].Payment != null)
                {
                    var paymentIntentId = invoice.Payments.Data[0].Payment.PaymentIntentId;

                    // Retrieve the payment intent used to pay the subscription
                    var service = new PaymentIntentService();
                    var paymentIntent = service.Get(paymentIntentId);

                    // Get subscription ID from parent
                    if (invoice.Parent?.SubscriptionDetails != null)
                    {
                        var subscriptionId = invoice.Parent.SubscriptionDetails.SubscriptionId;

                        // Set the default payment method
                        var options = new SubscriptionUpdateOptions
                        {
                          DefaultPaymentMethod = paymentIntent.PaymentMethodId,
                        };
                        var subscriptionService = new SubscriptionService();
                        subscriptionService.Update(subscriptionId, options);

                        Console.WriteLine($"Default payment method set for subscription: {paymentIntent.PaymentMethodId}");
                    }
                }
              }
              Console.WriteLine($"Payment succeeded for invoice: {stripeEvent.Id}");
            }

            if (stripeEvent.Type == "invoice.paid")
            {
                // Used to provision services after the trial has ended.
                // The status of the invoice will show up as paid. Store the status in your
                // database to reference when a user accesses your service to avoid hitting rate
                // limits.
            }
            if (stripeEvent.Type == "invoice.payment_failed")
            {
                // If the payment fails or the customer does not have a valid payment method,
                // an invoice.payment_failed event is sent, the subscription becomes past_due.
                // Use this webhook to notify your user that their payment has
                // failed and to retrieve new card details.
            }
            if (stripeEvent.Type == "invoice.finalized")
            {
                // If you want to manually send out invoices to your customers
                // or store them locally to reference to avoid hitting Stripe rate limits.
            }
            if (stripeEvent.Type == "customer.subscription.deleted")
            {
                // handle subscription cancelled automatically based
                // upon your subscription settings. Or if the user cancels it.
            }
            if (stripeEvent.Type == "customer.subscription.trial_will_end")
            {
                // Send notification to your user that the trial will end
            }

            return Ok();
        }
    }
}
