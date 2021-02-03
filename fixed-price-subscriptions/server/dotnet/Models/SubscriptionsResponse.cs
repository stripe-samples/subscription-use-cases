using Newtonsoft.Json;
using Stripe;

public class SubscriptionsResponse
{
    [JsonProperty("subscriptions")]
    public StripeList<Subscription> Subscriptions { get; set; }
}
