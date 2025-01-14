using Newtonsoft.Json;
using Stripe;

public class CreateSubscriptionResponse : Response
{
    [JsonProperty("subscription")]
    public Subscription Subscription { get; set; }
}