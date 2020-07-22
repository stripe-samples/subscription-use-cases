using Newtonsoft.Json;
using Stripe;

public class RetrieveSubscriptionInformationResponse
{
    [JsonProperty("card")]
    public PaymentMethodCard Card { get; set; }

    [JsonProperty("product_description")]
    public string ProductDescription { get; set; }

    [JsonProperty("current_price")]
    public string CurrentPrice { get; set; }

    [JsonProperty("current_quantity")]
    public long CurrentQuantity { get; set; }

    [JsonProperty("latest_invoice")]
    public Invoice LatestInvoice { get; set; }

    [JsonProperty("upcoming_invoice")]
    public Invoice UpcomingInvoice { get; set; }
}