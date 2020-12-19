package main

import (
	"bytes"
	"encoding/json"
	"errors"
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
	}, nil)
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
		writeJSON(w, nil, err)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	params := &stripe.CustomerParams{
		Email: stripe.String(req.Email),
	}

	c, err := customer.New(params)
	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("customer.New: %v", err)
		return
	}

	writeJSON(w, struct {
		Customer *stripe.Customer `json:"customer"`
	}{
		Customer: c,
	}, nil)
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
		writeJSON(w, nil, err)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	pm, err := paymentmethod.Get(req.PaymentMethodID, nil)
	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("paymentmethod.Get: %v", err)
		return
	}

	writeJSON(w, pm, nil)
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
		writeJSON(w, nil, err)
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
		writeJSON(w, nil, err)
		log.Printf("paymentmethod.Attach: %v %s", err, pm.ID)
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
		writeJSON(w, nil, err)
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
	s, err := sub.New(subscriptionParams)

	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("sub.New: %v", err)
		return
	}

	writeJSON(w, s, nil)
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
		writeJSON(w, nil, err)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	s, err := sub.Cancel(req.SubscriptionID, nil)

	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("sub.Cancel: %v", err)
		return
	}

	writeJSON(w, s, nil)
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
		writeJSON(w, nil, err)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	s, err := sub.Get(req.SubscriptionID, nil)
	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("sub.Get: %v", err)
		return
	}
	params := &stripe.InvoiceParams{
		Customer:     stripe.String(req.CustomerID),
		Subscription: stripe.String(req.SubscriptionID),
		SubscriptionItems: []*stripe.SubscriptionItemsParams{{
			ID:      stripe.String(s.Items.Data[0].ID),
			Deleted: stripe.Bool(true),
		}, {
			Price:   stripe.String(os.Getenv(req.NewPriceID)),
			Deleted: stripe.Bool(false),
		}},
	}
	in, err := invoice.GetNext(params)

	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("invoice.GetNext: %v", err)
		return
	}

	writeJSON(w, in, nil)
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
		writeJSON(w, nil, err)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	s, err := sub.Get(req.SubscriptionID, nil)
	if err != nil {
		writeJSON(w, nil, err)
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
		writeJSON(w, nil, err)
		log.Printf("sub.Update: %v", err)
		return
	}

	writeJSON(w, updatedSubscription, nil)
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
		writeJSON(w, nil, err)
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
		writeJSON(w, nil, err)
		log.Printf("paymentmethod.Attach: %v %s", err, pm.ID)
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
		writeJSON(w, nil, err)
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
		writeJSON(w, nil, err)
		log.Printf("invoice.Get: %v", err)
		return
	}

	writeJSON(w, in, nil)
}

func handleWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	b, err := ioutil.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("ioutil.ReadAll: %v", err)
		return
	}

	event, err := webhook.ConstructEvent(b, r.Header.Get("Stripe-Signature"), os.Getenv("STRIPE_WEBHOOK_SECRET"))
	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("webhook.ConstructEvent: %v", err)
		return
	}

	if event.Type != "checkout.session.completed" {
		return
	}

	cust, err := customer.Get(event.GetObjectValue("customer"), nil)
	if err != nil {
		writeJSON(w, nil, err)
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

type errResp struct {
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
}

func writeJSON(w http.ResponseWriter, v interface{}, err error) {
	var respVal interface{}
	if err != nil {
		msg := err.Error()
		var serr *stripe.Error
		if errors.As(err, &serr) {
			msg = serr.Msg
		}
    // This is what it should be, but the other servers were inconsistent.
    // TODO(cjavilla): Fix this so it's 400 not 200.
		// w.WriteHeader(http.StatusBadRequest)
		var e errResp
		e.Error.Message = msg
		respVal = e
	} else {
		respVal = v
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(respVal); err != nil {
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
