using Newtonsoft.Json;

public class CreateSubscriptionRequest
{
    [JsonProperty("paymentMethodId")]
    public string PaymentMethod { get; set; }

    [JsonProperty("priceLookupKey")]
    public string Price { get; set; }
}
