using Newtonsoft.Json;

public class UpdateSubscriptionRequest
{
    [JsonRequired]
    [JsonProperty("subscriptionId")]
    public string Subscription { get; set; }

    [JsonRequired]
    [JsonProperty("newPriceId")]
    public string NewPrice { get; set; }

    [JsonRequired]
    [JsonProperty("quantity")]
    public long Quantity { get; set; }
}