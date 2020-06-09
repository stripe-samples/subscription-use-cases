using Newtonsoft.Json;
using Stripe;

public class CreateCustomerResponse
{
    [JsonProperty("customer")]
    public Customer Customer { get; set; }
}