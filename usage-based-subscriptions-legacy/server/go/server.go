package main

import (
	"bytes"
	"encoding/json"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"github.com/stripe/stripe-go/v71"
	"github.com/stripe/stripe-go/v71/customer"
	"github.com/stripe/stripe-go/v71/invoice"
	"github.com/stripe/stripe-go/v71/paymentmethod"
	"github.com/stripe/stripe-go/v71/sub"
	"github.com/stripe/stripe-go/v71/webhook"
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
	http.HandleFunc("/retrieve-customer-payment-method", handleRetrieveCustomerPaymentMethod)
	http.HandleFunc("/create-subscription", handleCreateSubscription)
	http.HandleFunc("/cancel-subscription", handleCancelSubscription)
	http.HandleFunc("/update-subscription", handleUpdateSubscription)
	http.HandleFunc("/retry-invoice", handleRetryInvoice)
	http.HandleFunc("/retrieve-upcoming-invoice", handleRetrieveUpcomingInvoice)
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

func handleCreateCustomer(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Email string `json:"email"`
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
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("customer.New: %v", err)
		return
	}

	writeJSON(w, struct {
		Customer *stripe.Customer `json:"customer"`
	}{
		Customer: c,
	})
}

func handleRetrieveCustomerPaymentMethod(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		PaymentMethodID string `json:"paymentMethodId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	pm, err := paymentmethod.Get(req.PaymentMethodID, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("paymentmethod.Get: %v", err)
		return
	}

	writeJSON(w, pm)
}

func handleCreateSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		PaymentMethodID string `json:"paymentMethodId"`
		CustomerID      string `json:"customerId"`
		PriceID         string `json:"priceId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	// Attach PaymentMethod
	params := &stripe.PaymentMethodAttachParams{
		Customer: stripe.String(req.CustomerID),
	}
	pm, err := paymentmethod.Attach(
		req.PaymentMethodID,
		params,
	)
	if err != nil {
		writeJSON(w, struct {
			Error error `json:"error"`
		}{err})
		return
	}

	// Update invoice settings default
	customerParams := &stripe.CustomerParams{
		InvoiceSettings: &stripe.CustomerInvoiceSettingsParams{
			DefaultPaymentMethod: stripe.String(pm.ID),
		},
	}
	c, err := customer.Update(
		req.CustomerID,
		customerParams,
	)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("customer.Update: %v %s", err, c.ID)
		return
	}

	// Create subscription
	subscriptionParams := &stripe.SubscriptionParams{
		Customer: stripe.String(req.CustomerID),
		Items: []*stripe.SubscriptionItemsParams{
			{
				Plan: stripe.String(os.Getenv(req.PriceID)),
			},
		},
	}
	subscriptionParams.AddExpand("latest_invoice.payment_intent")
	subscriptionParams.AddExpand("pending_setup_intent")

	s, err := sub.New(subscriptionParams)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("sub.New: %v", err)
		return
	}

	writeJSON(w, s)
}

func handleCancelSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		SubscriptionID string `json:"subscriptionId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	s, err := sub.Cancel(req.SubscriptionID, nil)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("sub.Cancel: %v", err)
		return
	}

	writeJSON(w, s)
}

func handleRetrieveUpcomingInvoice(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		SubscriptionID string `json:"subscriptionId"`
		CustomerID     string `json:"customerId"`
		NewPriceID     string `json:"newPriceId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	s, err := sub.Get(req.SubscriptionID, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("sub.Get: %v", err)
		return
	}
	params := &stripe.InvoiceParams{
		Customer:     stripe.String(req.CustomerID),
		Subscription: stripe.String(req.SubscriptionID),
		SubscriptionItems: []*stripe.SubscriptionItemsParams{{
			ID:         stripe.String(s.Items.Data[0].ID),
			Deleted:    stripe.Bool(true),
			ClearUsage: stripe.Bool(true),
		}, {
			Price:   stripe.String(os.Getenv(req.NewPriceID)),
			Deleted: stripe.Bool(false),
		}},
	}
	in, err := invoice.GetNext(params)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("invoice.GetNext: %v", err)
		return
	}

	writeJSON(w, in)
}

func handleUpdateSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		SubscriptionID string `json:"subscriptionId"`
		NewPriceID     string `json:"newPriceId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	s, err := sub.Get(req.SubscriptionID, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("sub.Get: %v", err)
		return
	}

	params := &stripe.SubscriptionParams{
		CancelAtPeriodEnd: stripe.Bool(false),
		Items: []*stripe.SubscriptionItemsParams{{
			ID:    stripe.String(s.Items.Data[0].ID),
			Price: stripe.String(os.Getenv(req.NewPriceID)),
		}},
	}

	updatedSubscription, err := sub.Update(req.SubscriptionID, params)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("sub.Update: %v", err)
		return
	}

	writeJSON(w, updatedSubscription)
}

func handleRetryInvoice(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		CustomerID      string `json:"customerId"`
		PaymentMethodID string `json:"paymentMethodId"`
		InvoiceID       string `json:"invoiceId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	// Attach PaymentMethod
	params := &stripe.PaymentMethodAttachParams{
		Customer: stripe.String(req.CustomerID),
	}
	pm, err := paymentmethod.Attach(
		req.PaymentMethodID,
		params,
	)
	if err != nil {
		writeJSON(w, struct {
			Error error `json:"error"`
		}{err})
		return
	}

	// Update invoice settings default
	customerParams := &stripe.CustomerParams{
		InvoiceSettings: &stripe.CustomerInvoiceSettingsParams{
			DefaultPaymentMethod: stripe.String(pm.ID),
		},
	}
	c, err := customer.Update(
		req.CustomerID,
		customerParams,
	)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("customer.Update: %v %s", err, c.ID)
		return
	}

	// Retrieve Invoice
	invoiceParams := &stripe.InvoiceParams{}
	invoiceParams.AddExpand("payment_intent")
	in, err := invoice.Get(
		req.InvoiceID,
		invoiceParams,
	)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("invoice.Get: %v", err)
		return
	}

	writeJSON(w, in)
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
