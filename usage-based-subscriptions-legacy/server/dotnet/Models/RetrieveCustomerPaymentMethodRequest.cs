using Newtonsoft.Json;

public class RetrieveCustomerPaymentMethodRequest
{
    [JsonProperty("paymentMethodId")]
    public string PaymentMethod { get; set; }
}