using Newtonsoft.Json;

public class UpdateSubscriptionRequest
{
    [JsonProperty("subscriptionId")]
    public string Subscription { get; set; }

    [JsonProperty("newPriceId")]
    public string NewPrice { get; set; }
}