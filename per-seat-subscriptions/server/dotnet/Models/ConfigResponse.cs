using Newtonsoft.Json;

public class ConfigResponse
{
    [JsonProperty("publishableKey")]
    public string PublishableKey { get; set; }
}
