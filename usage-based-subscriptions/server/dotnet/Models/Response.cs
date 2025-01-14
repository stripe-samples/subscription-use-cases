using Newtonsoft.Json;

public class Response
{
    [JsonProperty("error")]
    public Error Error {get; set;}
}
