package main

import (
	"bytes"
	"encoding/json"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/joho/godotenv"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/billing/meter"
	"github.com/stripe/stripe-go/v81/customer"
	"github.com/stripe/stripe-go/v81/price"
	"github.com/stripe/stripe-go/v81/rawrequest"
	"github.com/stripe/stripe-go/v81/subscription"

	"github.com/stripe/stripe-go/v81/webhook"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Fatalf("godotenv.Load: %v", err)
	}

	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")
	// For sample support and debugging, not required for production:
	stripe.SetAppInfo(&stripe.AppInfo{
		Name:    "stripe-samples/subscription-use-cases/usage-based-subscriptions",
		Version: "0.0.1",
		URL:     "https://github.com/stripe-samples/subscription-use-cases/usage-based-subscriptions",
	})

	http.Handle("/", http.FileServer(http.Dir(os.Getenv("STATIC_DIR"))))
	http.HandleFunc("/config", handleConfig)
	http.HandleFunc("/create-customer", handleCreateCustomer)
	http.HandleFunc("/create-meter", handleCreateMeter)
	http.HandleFunc("/create-price", handleCreatePrice)
	http.HandleFunc("/create-subscription", handleCreateSubscription)
	http.HandleFunc("/create-meter-event", handleCreateMeterEvent)
	http.HandleFunc("/webhook", handleWebhook)

	addr := "0.0.0.0:4242"
	log.Printf("Listening on %s ...", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, struct {
		PublishableKey string `json:"publishableKey"`
	}{
		PublishableKey: os.Getenv("STRIPE_PUBLISHABLE_KEY"),
	})
}

type ErrorResponse struct {
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
}

func constructErrorResponse(message string) string {
	// Create an instance of ErrorResponse
	response := ErrorResponse{}
	response.Error.Message = message
	// Marshal the response into a JSON string
	jsonData, _ := json.Marshal(response)
	return string(jsonData)
}

func handleCreateCustomer(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Email string `json:"email"`
		Name  string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	params := &stripe.CustomerParams{
		Email: stripe.String(req.Email),
	}

	c, err := customer.New(params)
	if err != nil {
		if stripeErr, ok := err.(*stripe.Error); ok {
			http.Error(w, constructErrorResponse(stripeErr.Msg), http.StatusBadRequest)
			log.Printf("customer.New: %v", err)
		}
		return
	}

	writeJSON(w, struct {
		Customer *stripe.Customer `json:"customer"`
	}{
		Customer: c,
	})
}

func handleCreateMeter(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		DisplayName        string `json:"displayName"`
		EventName          string `json:"eventName"`
		AggregationFormula string `json:"aggregationFormula"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	params := &stripe.BillingMeterParams{
		DisplayName: stripe.String(req.DisplayName),
		EventName: stripe.String(req.EventName),
		DefaultAggregation: &stripe.BillingMeterDefaultAggregationParams{
			Formula: stripe.String(req.AggregationFormula),
		},
	}

	c, err := meter.New(params)
	if err != nil {
		if stripeErr, ok := err.(*stripe.Error); ok {
			http.Error(w, constructErrorResponse(stripeErr.Msg), http.StatusBadRequest)
			log.Printf("meter.New: %v", err)
		}
		return
	}

	writeJSON(w, struct {
		Meter *stripe.BillingMeter `json:"meter"`
	}{
		Meter: c,
	})
}

func handleCreatePrice(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Currency    string `json:"currency"`
		Amount      int64 `json:"amount"`
		MeterId     string `json:"meterId"`
		ProductName string `json:"productName"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	// Create a new price
	params := &stripe.PriceParams{
		UnitAmount: stripe.Int64(req.Amount),
		Currency: stripe.String(req.Currency),
		Recurring: &stripe.PriceRecurringParams{
			Interval: stripe.String(string(stripe.PriceRecurringIntervalMonth)),
			Meter: stripe.String(req.MeterId),
			UsageType: stripe.String(string(stripe.PriceRecurringUsageTypeMetered)),
		},
		ProductData: &stripe.PriceProductDataParams{
			Name: stripe.String(req.ProductName),
		},
	}

	p, err := price.New(params)
	if err != nil {
		if stripeErr, ok := err.(*stripe.Error); ok {
			http.Error(w, constructErrorResponse(stripeErr.Msg), http.StatusBadRequest)
			log.Printf("price.New: %v", err)
		}
		return
	}

	writeJSON(w, struct {
		Price *stripe.Price `json:"price"`
	}{
		Price: p,
	})
}

func handleCreateSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		CustomerID string `json:"customerId"`
		PriceID    string `json:"priceId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	// Create subscription
	subscriptionParams := &stripe.SubscriptionParams{
		Customer: stripe.String(req.CustomerID),
		Items: []*stripe.SubscriptionItemsParams{
			{
				Price: stripe.String(req.PriceID),
			},
		},
	}
	subscriptionParams.AddExpand("pending_setup_intent")

	subscription, err := subscription.New(subscriptionParams)

	if err != nil {
		if stripeErr, ok := err.(*stripe.Error); ok {
			http.Error(w, constructErrorResponse(stripeErr.Msg), http.StatusBadRequest)
			log.Printf("subscription.New: %v", err)
		}
		return
	}

	writeJSON(w, struct {
		Subscription *stripe.Subscription `json:"subscription"`
	}{
		Subscription: subscription,
	})
}

func handleCreateMeterEvent(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		EventName  string `json:"eventName"`
		Value      int `json:"value"`
		CustomerID string `json:"customerId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	// v2 API support isn't availble in the Stripe Go library yet, so we use the raw request backend
	b, _ := stripe.GetRawRequestBackend(stripe.APIBackend);
	c := rawrequest.Client{B: b, Key: os.Getenv("STRIPE_SECRET_KEY")};

	params := &map[string]interface{}{
		"event_name": req.EventName,
		"payload": map[string]string{
			"stripe_customer_id": req.CustomerID,
			"value": strconv.Itoa(req.Value),
		},
	}

	content, _ := json.Marshal(params);

	response, err := c.RawRequest(
		http.MethodPost,
		"/v2/billing/meter_events",
		string(content),
		nil,
	);

	var responseObject map[string]interface{}
	json.Unmarshal(response.RawJSON, &responseObject)

	if err != nil {
		if stripeErr, ok := err.(*stripe.Error); ok {
			http.Error(w, constructErrorResponse(stripeErr.Msg), http.StatusBadRequest)
			log.Printf("meterEvent.New: %v", err)
		}
		return
	}

	writeJSON(w, struct {
		MeterEvent map[string]interface{} `json:"meterEvent"`
	}{
		MeterEvent: responseObject,
	})
}

func handleWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	b, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		log.Printf("ioutil.ReadAll: %v", err)
		return
	}

	event, err := webhook.ConstructEvent(b, r.Header.Get("Stripe-Signature"), os.Getenv("STRIPE_WEBHOOK_SECRET"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		log.Printf("webhook.ConstructEvent: %v", err)
		return
	}

	if event.Type != "checkout.session.completed" {
		return
	}

	cust, err := customer.Get(event.GetObjectValue("customer"), nil)
	if err != nil {
		log.Printf("customer.Get: %v", err)
		return
	}

	if event.GetObjectValue("display_items", "0", "custom") != "" &&
		event.GetObjectValue("display_items", "0", "custom", "name") == "Pasha e-book" {
		log.Printf("🔔 Customer is subscribed and bought an e-book! Send the e-book to %s", cust.Email)
	} else {
		log.Printf("🔔 Customer is subscribed but did not buy an e-book.")
	}
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(v); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("json.NewEncoder.Encode: %v", err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if _, err := io.Copy(w, &buf); err != nil {
		log.Printf("io.Copy: %v", err)
		return
	}
}
