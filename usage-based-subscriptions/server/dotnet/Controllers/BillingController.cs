using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Billing;

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
        public ActionResult<Response> CreateCustomer([FromBody] CreateCustomerRequest req)
        {
            var options = new CustomerCreateOptions
            {
                Email = req.Email,
                Name = req.Name,
            };
            try
            {
                var service = new CustomerService();
                var customer = service.Create(options);
                return new CreateCustomerResponse
                {
                    Customer = customer,
                };
            }
            catch (StripeException e) {
                return new CreateCustomerResponse
                {
                    Error = new Error{
                        Message = e.StripeError.Message
                    }
                };
            }
        }

        [HttpPost("create-meter")]
        public ActionResult<Response> CreateMeter([FromBody] CreateMeterRequest req)
        {
            var options = new MeterCreateOptions
            {
                DisplayName = req.DisplayName,
                EventName = req.EventName,
                DefaultAggregation = new MeterDefaultAggregationOptions
                {
                    Formula = req.AggregationFormula,
                },
            };
            try
            {
                var service = new MeterService();
                var meter = service.Create(options);
                return new CreateMeterResponse
                {
                    Meter = meter,
                };
            }
            catch (StripeException e) {
                return new CreateMeterResponse
                {
                    Error = new Error{
                        Message = e.StripeError.Message
                    }
                };
            }
        }

        [HttpPost("create-price")]
        public ActionResult<Response> CreatePrice([FromBody] CreatePriceRequest req)
        {
            var options = new PriceCreateOptions
            {
                Currency = req.Currency,
                UnitAmount = req.Amount,
                Recurring = new PriceRecurringOptions { 
                    Interval = "month",
                    Meter = req.MeterId,
                    UsageType = "metered"
                },
                ProductData = new PriceProductDataOptions {
                    Name = req.ProductName
                }
            };
            try
            {
                var service = new PriceService();
                var price = service.Create(options);
                return new CreatePriceResponse
                {
                    Price = price,
                };
            }
            catch (StripeException e) {
                return new CreatePriceResponse
                {
                    Error = new Error{
                        Message = e.StripeError.Message
                    }
                };
            }
        }

        [HttpPost("create-subscription")]
        public ActionResult<Response> CreateSubscription([FromBody] CreateSubscriptionRequest req)
        {
           
            // Create subscription
            var subscriptionOptions = new SubscriptionCreateOptions
            {
                Customer = req.CustomerId,
                Items = new List<SubscriptionItemOptions>
                {
                    new SubscriptionItemOptions
                    {
                        Price = req.PriceId
                    },
                },
            };
            subscriptionOptions.AddExpand("pending_setup_intent");
            var subscriptionService = new SubscriptionService();
            try
            {
                Subscription subscription = subscriptionService.Create(subscriptionOptions);
                return new CreateSubscriptionResponse
                 {
                    Subscription = subscription,
                };
            }
            catch (StripeException e) {
                return new CreateSubscriptionResponse
                {
                    Error = new Error{
                        Message = e.StripeError.Message
                    }
                };
            }
        }

        [HttpPost("create-meter-event")]
        public ActionResult<Response> CreateMeterEvent([FromBody] CreateMeterEventRequest req)
        {
            var options = new Stripe.V2.Billing.MeterEventCreateOptions
            {
                EventName = req.EventName,
                Payload = new Dictionary<string, string>
                {
                    { "stripe_customer_id", req.CustomerId },
                    { "value", req.Value.ToString() },
                },
            };
            try
            {
                var client = new StripeClient(this.options.Value.SecretKey);
                var service = client.V2.Billing.MeterEvents;
                var meterEvent = service.Create(options);
                return new CreateMeterEventResponse
                {
                    MeterEvent = meterEvent,
                };
            }
            catch (StripeException e) {
                return new CreateMeterEventResponse
                {
                    Error = new Error{
                        Message = e.StripeError.Message
                    }
                };
            }
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
