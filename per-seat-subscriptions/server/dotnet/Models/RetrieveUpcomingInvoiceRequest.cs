using Newtonsoft.Json;

public class RetrieveUpcomingInvoiceRequest
{
    [JsonRequired]
    [JsonProperty("customerId")]
    public string Customer { get; set; }

    [JsonProperty("subscriptionId")]
    public string Subscription { get; set; }

    [JsonRequired]
    [JsonProperty("newPriceId")]
    public string NewPrice { get; set; }

    [JsonRequired]
    [JsonProperty("quantity")]
    public long Quantity { get; set; }
}