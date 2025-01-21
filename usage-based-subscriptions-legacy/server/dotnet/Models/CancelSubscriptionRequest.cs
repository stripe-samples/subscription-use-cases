using Newtonsoft.Json;

public class CancelSubscriptionRequest
{
    [JsonProperty("subscriptionId")]
    public string Subscription { get; set; }
}