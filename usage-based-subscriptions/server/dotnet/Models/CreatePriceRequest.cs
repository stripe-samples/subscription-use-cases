using Newtonsoft.Json;

public class CreatePriceRequest
{
    [JsonProperty("currency")]
    public string Currency { get; set; }
    
    [JsonProperty("amount")]
    public int Amount { get; set; }

    [JsonProperty("meterId")]
    public string MeterId { get; set; }

    [JsonProperty("productName")]
    public string ProductName { get; set; }
}