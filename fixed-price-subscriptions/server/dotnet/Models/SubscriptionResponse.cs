using Stripe;
using Newtonsoft.Json;


public class SubscriptionResponse
{
  [JsonProperty("subscription")]
  public Subscription Subscription { get; set; }
}
