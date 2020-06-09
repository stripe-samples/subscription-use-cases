using Newtonsoft.Json;

public class RetrieveUpcomingInvoiceRequest
{
    [JsonProperty("customerId")]
    public string Customer { get; set; }

    [JsonProperty("subscriptionId")]
    public string Subscription { get; set; }

    [JsonProperty("newPriceId")]
    public string NewPrice { get; set; }
}