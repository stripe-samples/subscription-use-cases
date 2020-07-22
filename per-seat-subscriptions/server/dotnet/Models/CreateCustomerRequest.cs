using Newtonsoft.Json;

public class CreateCustomerRequest
{
    [JsonProperty("email")]
    public string Email { get; set; }
}