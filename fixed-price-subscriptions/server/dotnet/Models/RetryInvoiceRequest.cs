using Newtonsoft.Json;

public class RetryInvoiceRequest
{
    [JsonProperty("customerId")]
    public string Customer { get; set; }

    [JsonProperty("paymentMethodId")]
    public string PaymentMethod { get; set; }

    [JsonProperty("invoiceId")]
    public string Invoice { get; set; }
}