using Newtonsoft.Json;

public class RetrieveSubscriptionInformationRequest
{
    [JsonRequired]
    [JsonProperty("subscriptionId")]
    public string Subscription { get; set; }
}