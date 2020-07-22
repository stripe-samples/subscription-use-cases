using Newtonsoft.Json;
using Stripe;

public class UpdateSubscriptionResponse
{
    [JsonProperty("subscription")]
    public Subscription Subscription { get; set; }
}