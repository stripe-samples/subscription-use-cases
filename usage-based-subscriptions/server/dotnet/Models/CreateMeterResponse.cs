using Newtonsoft.Json;
using Stripe.Billing;

public class CreateMeterResponse : Response
{
    [JsonProperty("meter")]
    public Meter Meter { get; set; }
}