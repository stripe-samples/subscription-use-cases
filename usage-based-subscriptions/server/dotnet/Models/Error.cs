using Newtonsoft.Json;

public class Error
{
    [JsonProperty("message")]
    public string Message { get; set; }
}
