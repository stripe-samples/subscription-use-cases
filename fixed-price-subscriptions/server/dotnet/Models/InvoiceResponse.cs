using Stripe;
using Newtonsoft.Json;

public class InvoiceResponse
{
  [JsonProperty("invoice")]
  public Invoice Invoice { get; set; }
}
