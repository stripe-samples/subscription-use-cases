using Newtonsoft.Json;
using Stripe;

public class RetrieveUpcomingInvoiceResponse
{
    [JsonProperty("immediate_total", NullValueHandling = NullValueHandling.Ignore)]
    public long? ImmediateTotal { get; set; }

    [JsonProperty("next_invoice_sum", NullValueHandling = NullValueHandling.Ignore)]
    public long? NextInvoiceSum { get; set; }

    [JsonProperty("invoice")]
    public Invoice Invoice;
}