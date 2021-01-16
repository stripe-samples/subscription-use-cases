using Newtonsoft.Json;

public class UpdateSubscriptionRequest
{
    [JsonProperty("subscriptionId")]
    public string Subscription { get; set; }

    [JsonProperty("newPriceLookupKey")]
    public string NewPrice { get; set; }
}
