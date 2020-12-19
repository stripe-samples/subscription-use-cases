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
            return new ConfigResponse
            {
                PublishableKey = this.options.Value.PublishableKey,
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
            return new CreateCustomerResponse
            {
                Customer = customer,
            };
        }

        [HttpPost("create-subscription")]
        public ActionResult<Subscription> CreateSubscription([FromBody] CreateSubscriptionRequest req)
        {
            // Attach payment method
            var options = new PaymentMethodAttachOptions
            {
                Customer = req.Customer,
            };
            var service = new PaymentMethodService();
            var paymentMethod = service.Attach(req.PaymentMethod, options);

            // Update customer's default invoice payment method
            var customerOptions = new CustomerUpdateOptions
            {
                InvoiceSettings = new CustomerInvoiceSettingsOptions
                {
                    DefaultPaymentMethod = paymentMethod.Id,
                },
            };
            var customerService = new CustomerService();
            customerService.Update(req.Customer, customerOptions);

            // Create subscription
            var subscriptionOptions = new SubscriptionCreateOptions
            {
                Customer = req.Customer,
                Items = new List<SubscriptionItemOptions>
                {
                    new SubscriptionItemOptions
                    {
                        Price = Environment.GetEnvironmentVariable(req.Price),
                    },
                },
            };
            subscriptionOptions.AddExpand("latest_invoice.payment_intent");
            subscriptionOptions.AddExpand("pending_setup_intent");
            var subscriptionService = new SubscriptionService();
            try
            {
                Subscription subscription = subscriptionService.Create(subscriptionOptions);
                return subscription;
            }
            catch (StripeException e)
            {
                Console.WriteLine($"Failed to create subscription.{e}");
                return BadRequest();
            }
        }

        [HttpPost("retry-invoice")]
        public ActionResult<Invoice> RetryInvoice([FromBody] RetryInvoiceRequest req)
        {
            // Attach payment method
            var options = new PaymentMethodAttachOptions
            {
                Customer = req.Customer,
            };
            var service = new PaymentMethodService();
            var paymentMethod = service.Attach(req.PaymentMethod, options);

            // Update customer's default invoice payment method
            var customerOptions = new CustomerUpdateOptions
            {
                InvoiceSettings = new CustomerInvoiceSettingsOptions
                {
                    DefaultPaymentMethod = paymentMethod.Id,
                },
            };
            var customerService = new CustomerService();
            customerService.Update(req.Customer, customerOptions);

            var invoiceOptions = new InvoiceGetOptions();
            invoiceOptions.AddExpand("payment_intent");
            var invoiceService = new InvoiceService();
            Invoice invoice = invoiceService.Get(req.Invoice, invoiceOptions);
            return invoice;
        }

        [HttpPost("retrieve-upcoming-invoice")]
        public ActionResult<Invoice> RetrieveUpcomingInvoice([FromBody] RetrieveUpcomingInvoiceRequest req)
        {
            var service = new SubscriptionService();
            var subscription = service.Get(req.Subscription);

            var invoiceService = new InvoiceService();
            var options = new UpcomingInvoiceOptions
            {
                Customer = req.Customer,
                Subscription = req.Subscription,
                SubscriptionItems = new List<InvoiceSubscriptionItemOptions>
                {
                    new InvoiceSubscriptionItemOptions
                    {
                        Id = subscription.Items.Data[0].Id,
                        Deleted = true,
                        ClearUsage = true,
                    },
                    new InvoiceSubscriptionItemOptions
                    {
                        // TODO: This should be Price, but isnt in Stripe.net yet.
                        Plan = Environment.GetEnvironmentVariable(req.NewPrice),
                        Deleted = false,
                    },
                }
            };
            Invoice upcoming = invoiceService.Upcoming(options);
            return upcoming;
        }

        [HttpPost("cancel-subscription")]
        public ActionResult<Subscription> CancelSubscription([FromBody] CancelSubscriptionRequest req)
        {
            var service = new SubscriptionService();
            var subscription = service.Cancel(req.Subscription, null);
            return subscription;
        }

        [HttpPost("update-subscription")]
        public ActionResult<Subscription> UpdateSubscription([FromBody] UpdateSubscriptionRequest req)
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
                        Price = Environment.GetEnvironmentVariable(req.NewPrice),
                    }
                }
            };
            var updatedSubscription = service.Update(req.Subscription, options);
            return updatedSubscription;
        }

        [HttpPost("retrieve-customer-payment-method")]
        public ActionResult<PaymentMethod> RetrieveCustomerPaymentMethod([FromBody] RetrieveCustomerPaymentMethodRequest req)
        {
            var service = new PaymentMethodService();
            var paymentMethod = service.Get(req.PaymentMethod);
            return paymentMethod;
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
