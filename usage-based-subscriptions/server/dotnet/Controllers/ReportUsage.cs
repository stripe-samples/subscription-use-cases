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

// Set your secret key. Remember to switch to your live secret key in production!
// See your keys here: https://dashboard.stripe.com/account/apikeys
StripeConfiguration.ApiKey = options.Value.SecretKey;

// This code can be run on an interval (e.g., every 24 hours) for each active
// metered subscription.

// You need to write some of your own business logic before creating the
// usage record. Pull a record of a customer from your database
// and extract the customer's Stripe Subscription Item ID and
// usage for the day. If you aren't storing subscription item IDs,
// you can retrieve the subscription and check for subscription items
// https://stripe.com/docs/api/subscriptions/object#subscription_object-items.
var subscriptionItemId = "{{SUBSCRIPTION_ITEM_ID}}";

// The usage number you've been keeping track of in your database for the last 24 hours.
var usageQuantity = 100L;

// The idempotency key allows you to retry this usage record call if it fails.
var idempotencyKey = System.Guid.NewGuid().ToString();

var timestamp = DateTimeOffset.FromUnixTimeSeconds(1597408025).UtcDateTime;

var service = new UsageRecordService();
try
{
  var usageRecord = service.Create(
    subscriptionItemId,
    new UsageRecordCreateOptions
    {
      Quantity = usageQuantity,
      Timestamp = timestamp,
      Action = "set",
    },
    new RequestOptions
    {
      IdempotencyKey = idempotencyKey,
    }
  );
}
catch (StripeException e) {
  Console.WriteLine($"Usage report failed for item {subscriptionItemId}:");
  Console.WriteLine($"{e} (idempotency key: {idempotencyKey})");
};