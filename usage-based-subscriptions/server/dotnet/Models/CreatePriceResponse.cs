using Newtonsoft.Json;
using Stripe;

public class CreatePriceResponse : Response
{
    [JsonProperty("price")]
    public Price Price { get; set; }
}