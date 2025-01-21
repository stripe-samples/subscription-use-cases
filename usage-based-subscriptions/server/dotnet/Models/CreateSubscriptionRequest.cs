using Newtonsoft.Json;

public class CreateSubscriptionRequest
{
    [JsonProperty("customerId")]
    public string CustomerId { get; set; }

    [JsonProperty("priceId")]
    public string PriceId { get; set; }
}