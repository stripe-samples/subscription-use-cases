using Newtonsoft.Json;

public class CreateSubscriptionRequest
{
    [JsonRequired]
    [JsonProperty("paymentMethodId")]
    public string PaymentMethod { get; set; }

    [JsonRequired]
    [JsonProperty("customerId")]
    public string Customer { get; set; }

    [JsonRequired]
    [JsonProperty("priceId")]
    public string Price { get; set; }

    [JsonRequired]
    [JsonProperty("quantity")]
    public long Quantity { get; set; }
}