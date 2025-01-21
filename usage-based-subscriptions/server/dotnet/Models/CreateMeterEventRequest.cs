using Newtonsoft.Json;

public class CreateMeterEventRequest
{   
    [JsonProperty("eventName")]
    public string EventName { get; set; }

    [JsonProperty("customerId")]
    public string CustomerId { get; set; }

    [JsonProperty("value")]
    public int Value { get; set; }
}