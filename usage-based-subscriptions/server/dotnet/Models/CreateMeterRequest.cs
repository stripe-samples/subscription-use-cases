using Newtonsoft.Json;

public class CreateMeterRequest
{
    [JsonProperty("eventName")]
    public string EventName { get; set; }
    
    [JsonProperty("displayName")]
    public string DisplayName { get; set; }

    [JsonProperty("aggregationFormula")]
    public string AggregationFormula { get; set; }
}