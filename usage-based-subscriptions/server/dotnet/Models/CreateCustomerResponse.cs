using Newtonsoft.Json;
using Stripe;

public class CreateCustomerResponse : Response
{
    [JsonProperty("customer")]
    public Customer Customer { get; set; }
}