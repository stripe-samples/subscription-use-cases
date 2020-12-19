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
            if (!ModelState.IsValid)
            {
                return this.FailWithMessage("invalid params");
            }
            var options = new CustomerCreateOptions
            {
                Email = req.Email,
            };
            var service = new CustomerService();
            Customer customer;
            try
            {
                customer = service.Create(options);
            }
            catch (StripeException e)
            {
                return this.FailWithMessage($"Failed to create customer: {e}");
            }
            return new CreateCustomerResponse
            {
                Customer = customer,
            };
        }

        [HttpPost("create-subscription")]
        public ActionResult<Subscription> CreateSubscription([FromBody] CreateSubscriptionRequest req)
        {
            if (!ModelState.IsValid)
            {
                return this.FailWithMessage("invalid params");
            }
            var newPrice = Environment.GetEnvironmentVariable(req.Price.ToUpper());
            if (newPrice is null || newPrice == "")
            {
                return this.FailWithMessage($"No price with the new price ID ({req.Price}) found in .env");
            }

            // Attach payment method
            var options = new PaymentMethodAttachOptions
            {
                Customer = req.Customer,
            };
            var service = new PaymentMethodService();

            PaymentMethod paymentMethod;
            try
            {
                paymentMethod = service.Attach(req.PaymentMethod, options);
            }
            catch (Exception e)
            {
                return this.FailWithMessage($"Failed to attach payment method {e}");
            }

            // Update customer's default invoice payment method
            var customerOptions = new CustomerUpdateOptions
            {
                InvoiceSettings = new CustomerInvoiceSettingsOptions
                {
                    DefaultPaymentMethod = paymentMethod.Id,
                },
            };
            var customerService = new CustomerService();
            try
            {
                customerService.Update(req.Customer, customerOptions);
            }
            catch (StripeException e)
            {
                return this.FailWithMessage($"Failed to attach payment method {e}");
            }

            // Create subscription
            var subscriptionOptions = new SubscriptionCreateOptions
            {
                Customer = req.Customer,
                Items = new List<SubscriptionItemOptions>
                {
                    new SubscriptionItemOptions
                    {
                        Price = Environment.GetEnvironmentVariable(req.Price),
                        Quantity = req.Quantity,
                    },
                },
            };
            subscriptionOptions.AddExpand("latest_invoice.payment_intent");
            var subscriptionService = new SubscriptionService();
            try
            {
                return subscriptionService.Create(subscriptionOptions);
            }
            catch (StripeException e)
            {
                return this.FailWithMessage($"Failed to attach payment method: {e}");
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

        [HttpPost("retrieve-subscription-information")]
        public ActionResult<RetrieveSubscriptionInformationResponse> RetrieveSubscriptionInformation([FromBody] RetrieveSubscriptionInformationRequest req)
        {
            if (!ModelState.IsValid)
            {
                return this.FailWithMessage("invalid params");
            }
            var options = new SubscriptionGetOptions();
            options.AddExpand("latest_invoice");
            options.AddExpand("customer.invoice_settings.default_payment_method");
            options.AddExpand("items.data.price.product");
            var service = new SubscriptionService();
            Subscription subscription;
            try
            {
                subscription = service.Get(req.Subscription, options);
            }
            catch (StripeException e)
            {
                return this.FailWithMessage($"Failed to retrieve subscription with ID ({req.Subscription}): {e}");
            }

            var invoiceOptions = new UpcomingInvoiceOptions
            {
                Subscription = req.Subscription,
            };
            var invoiceService = new InvoiceService();
            Invoice upcomingInvoice;
            try
            {
                upcomingInvoice = invoiceService.Upcoming(invoiceOptions);
            }
            catch (StripeException e)
            {
                return this.FailWithMessage($"Failed to retrieve upcoming invoice: {e}");
            }

            var item = subscription.Items.Data[0];
            return new RetrieveSubscriptionInformationResponse
            {
                Card = subscription.Customer.InvoiceSettings.DefaultPaymentMethod.Card,
                ProductDescription = item.Price.Product.Name,
                CurrentPrice = item.Price.Id,
                CurrentQuantity = item.Quantity,
                LatestInvoice = subscription.LatestInvoice,
                UpcomingInvoice = upcomingInvoice,
            };
        }

        [HttpPost("retrieve-upcoming-invoice")]
        public ActionResult<RetrieveUpcomingInvoiceResponse> RetrieveUpcomingInvoice([FromBody] RetrieveUpcomingInvoiceRequest req)
        {
            if (!ModelState.IsValid)
            {
                return this.FailWithMessage("invalid params");
            }
            var newPrice = Environment.GetEnvironmentVariable(req.NewPrice.ToUpper());
            if (newPrice is null || newPrice == "")
            {
                return this.FailWithMessage($"No price with the new price ID ({req.NewPrice}) found in .env");
            }

            List<InvoiceSubscriptionItemOptions> items;
            Subscription subscription = null;

            if (req.Subscription != "" && req.Subscription != null)
            {
                var subscriptionService = new SubscriptionService();
                subscription = subscriptionService.Get(req.Subscription);

                var currentPrice = subscription.Items.Data[0].Price.Id;
                if (currentPrice == newPrice)
                {
                    items = new List<InvoiceSubscriptionItemOptions> {
                        new InvoiceSubscriptionItemOptions
                        {
                            Id = subscription.Items.Data[0].Id,
                            Quantity = req.Quantity,
                        }
                    };
                }
                else
                {
                    items = new List<InvoiceSubscriptionItemOptions> {
                        new InvoiceSubscriptionItemOptions
                        {
                            Id = subscription.Items.Data[0].Id,
                            Deleted = true,
                        },
                        new InvoiceSubscriptionItemOptions
                        {
                            Price = newPrice,
                            Quantity = req.Quantity,
                        },
                    };
                }
            }
            else
            {
                items = new List<InvoiceSubscriptionItemOptions> {
                    new InvoiceSubscriptionItemOptions
                    {
                        Price = newPrice,
                        Quantity = req.Quantity,
                    },
                };
            }

            var invoiceService = new InvoiceService();
            var options = new UpcomingInvoiceOptions
            {
                Customer = req.Customer,
                Subscription = req.Subscription,
                SubscriptionItems = items,
            };
            Invoice upcomingInvoice = invoiceService.Upcoming(options);

            if (req.Subscription == "" || req.Subscription is null)
            {
                return new RetrieveUpcomingInvoiceResponse
                {
                    Invoice = upcomingInvoice,
                };
            }
            else
            {
                var currentPeriodEnd = subscription.CurrentPeriodEnd;
                long immediateTotal = 0;
                long nextInvoiceSum = 0;
                foreach (var lineItem in upcomingInvoice.Lines.Data)
                {
                    if (lineItem.Period.End == currentPeriodEnd)
                    {
                        immediateTotal += lineItem.Amount;
                    }
                    else
                    {
                        nextInvoiceSum += lineItem.Amount;
                    }
                }

                return new RetrieveUpcomingInvoiceResponse
                {
                    ImmediateTotal = immediateTotal,
                    NextInvoiceSum = nextInvoiceSum,
                    Invoice = upcomingInvoice,
                };
            }

        }

        [HttpPost("cancel-subscription")]
        public ActionResult<Subscription> CancelSubscription([FromBody] CancelSubscriptionRequest req)
        {
            var service = new SubscriptionService();
            var subscription = service.Cancel(req.Subscription, null);
            return subscription;
        }

        [HttpPost("update-subscription")]
        public ActionResult<UpdateSubscriptionResponse> UpdateSubscription([FromBody] UpdateSubscriptionRequest req)
        {
            if (!ModelState.IsValid)
            {
                return this.FailWithMessage("invalid params");
            }
            var newPrice = Environment.GetEnvironmentVariable(req.NewPrice);
            if (newPrice is null || newPrice == "")
            {
                return this.FailWithMessage($"No price with the new price ID ({req.NewPrice}) found in .env");
            }

            var service = new SubscriptionService();
            Subscription subscription;
            try
            {
                subscription = service.Get(req.Subscription);
            }
            catch (StripeException e)
            {
                return this.FailWithMessage($"Failed to retrieve subscription: {e}");
            }
            var currentPrice = subscription.Items.Data[0].Price.Id;

            List<SubscriptionItemOptions> items;

            if (currentPrice == newPrice)
            {
                items = new List<SubscriptionItemOptions>
                {
                    new SubscriptionItemOptions
                    {
                        Id = subscription.Items.Data[0].Id,
                        Quantity = req.Quantity,
                    },
                };
            }
            else
            {
                items = new List<SubscriptionItemOptions>
                {
                    new SubscriptionItemOptions
                    {
                        Id = subscription.Items.Data[0].Id,
                        Deleted = true,
                    },
                    new SubscriptionItemOptions
                    {
                        Price = newPrice,
                        Quantity = req.Quantity,
                    },
                };
            }

            var options = new SubscriptionUpdateOptions
            {
                CancelAtPeriodEnd = false,
                Items = items,
                ProrationBehavior = "always_invoice",
            };
            var updatedSubscription = service.Update(req.Subscription, options);
            return new UpdateSubscriptionResponse
            {
                Subscription = updatedSubscription,
            };
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

        private ActionResult FailWithMessage(string message, int statusCode = 400)
        {
            return this.StatusCode(statusCode, new { error = new { message = message } });
        }
    }
}
