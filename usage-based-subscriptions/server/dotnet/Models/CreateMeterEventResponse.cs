using Newtonsoft.Json;
using Stripe.V2.Billing;

public class CreateMeterEventResponse : Response
{
    [JsonProperty("meterEvent")]
    public MeterEvent MeterEvent { get; set; }
}