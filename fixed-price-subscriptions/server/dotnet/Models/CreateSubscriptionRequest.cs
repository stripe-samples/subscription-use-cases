using Newtonsoft.Json;

public class CreateSubscriptionRequest
{
    [JsonProperty("paymentMethodId")]
    public string PaymentMethod { get; set; }

    [JsonProperty("customerId")]
    public string Customer { get; set; }

    [JsonProperty("priceId")]
    public string Price { get; set; }
}