using Newtonsoft.Json;

public class CreateSubscriptionRequest
{
    [JsonProperty("priceId")]
    public string PriceId { get; set; }
}
