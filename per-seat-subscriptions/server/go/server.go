package main

import (
	"bytes"
	"encoding/json"
	"fmt"
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

// ErrorResponseMessage represents the structure of the error
// object sent in failed responses.
type ErrorResponseMessage struct {
	Message string `json:"message"`
}

// ErrorResponse represents the structure of the error object sent
// in failed responses.
type ErrorResponse struct {
	Error *ErrorResponseMessage `json:"error"`
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Fatalf("godotenv.Load: %v", err)
	}

	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")

	http.Handle("/", http.FileServer(http.Dir(os.Getenv("STATIC_DIR"))))
	http.HandleFunc("/config", handleConfig)
	http.HandleFunc("/create-customer", handleCreateCustomer)
	http.HandleFunc("/create-subscription", handleCreateSubscription)
	http.HandleFunc("/retry-invoice", handleRetryInvoice)
	http.HandleFunc("/retrieve-subscription-information", handleRetrieveSubscriptionInformation)
	http.HandleFunc("/retrieve-upcoming-invoice", handleRetrieveUpcomingInvoice)
	http.HandleFunc("/update-subscription", handleUpdateSubscription)
	http.HandleFunc("/cancel-subscription", handleCancelSubscription)
	http.HandleFunc("/stripe-webhook", handleWebhook)

	addr := "localhost:4242"
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

func handleCreateSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		PaymentMethodID string `json:"paymentMethodId"`
		CustomerID      string `json:"customerId"`
		PriceID         string `json:"priceId"`
		Quantity        int64  `json:"quantity"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONErrorMessage(w, err.Error(), 422)
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
		writeJSONErrorMessage(w, err.Error(), 422)
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
		writeJSONErrorMessage(w, err.Error(), 422)
		log.Printf("customer.Update: %v %s", err, c.ID)
		return
	}

	// Create subscription
	subscriptionParams := &stripe.SubscriptionParams{
		Customer: stripe.String(req.CustomerID),
		Items: []*stripe.SubscriptionItemsParams{
			{
				Price: stripe.String(os.Getenv(req.PriceID)),
			},
		},
	}
	subscriptionParams.AddExpand("latest_invoice.payment_intent")
	subscriptionParams.AddExpand("plan.product")
	s, err := sub.New(subscriptionParams)

	if err != nil {
		writeJSONErrorMessage(w, err.Error(), 422)
		log.Printf("sub.New: %v", err)
		return
	}

	writeJSON(w, s)
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
		http.Error(w, err.Error(), http.StatusInternalServerError)
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

func handleRetrieveSubscriptionInformation(w http.ResponseWriter, r *http.Request) {
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

	params := &stripe.SubscriptionParams{}
	params.AddExpand("latest_invoice")
	params.AddExpand("customer.invoice_settings.default_payment_method")
	params.AddExpand("plan.product")
	s, err := sub.Get(req.SubscriptionID, params)
	if err != nil {
		writeJSONErrorMessage(w, err.Error(), 422)
		log.Printf("sub.Get: %v", err)
		return
	}

	invoiceParams := &stripe.InvoiceParams{
		Subscription: stripe.String(req.SubscriptionID),
	}
	upcomingInvoice, err := invoice.GetNext(invoiceParams)
	if err != nil {
		writeJSONErrorMessage(w, err.Error(), 422)
		log.Printf("invoice.GetNext: %v", err)
		return
	}

	writeJSON(w, struct {
		Card            *stripe.PaymentMethodCard `json:"card"`
		Description     string                    `json:"product_description"`
		CurrentPriceID  string                    `json:"current_price"`
		CurrentQuantity int64                     `json:"current_quantity"`
		LatestInvoice   *stripe.Invoice           `json:"latest_invoice"`
		UpcomingInvoice *stripe.Invoice           `json:"upcoming_invoice"`
	}{
		Card:            s.Customer.InvoiceSettings.DefaultPaymentMethod.Card,
		Description:     s.Plan.Product.Name,
		CurrentPriceID:  s.Plan.ID,
		LatestInvoice:   s.LatestInvoice,
		UpcomingInvoice: upcomingInvoice,
	})
}

func handleRetrieveUpcomingInvoice(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		CustomerID     string `json:"customerId"`
		NewPriceID     string `json:"newPriceId"`
		Quantity       int64  `json:"quantity"`
		SubscriptionID string `json:"subscriptionId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONErrorMessage(w, err.Error(), 422)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	newPriceID := os.Getenv(req.NewPriceID)

	var items []*stripe.SubscriptionItemsParams
	var s stripe.Subscription

	if req.SubscriptionID != "" {
		s, err := sub.Get(req.SubscriptionID, nil)
		if err != nil {
			writeJSONErrorMessage(w, err.Error(), 422)
			log.Printf("sub.Get: %v", err)
			return
		}
		currentPriceID := s.Items.Data[0].Price.ID

		if currentPriceID == newPriceID {
			items = []*stripe.SubscriptionItemsParams{{
				ID:       stripe.String(s.Items.Data[0].ID),
				Quantity: stripe.Int64(req.Quantity),
			}}
		} else {
			items = []*stripe.SubscriptionItemsParams{{
				ID:      stripe.String(s.Items.Data[0].ID),
				Deleted: stripe.Bool(true),
			}, {
				Price:    stripe.String(newPriceID),
				Quantity: stripe.Int64(req.Quantity),
			}}
		}
	} else {
		items = []*stripe.SubscriptionItemsParams{{
			Price:    stripe.String(newPriceID),
			Quantity: stripe.Int64(req.Quantity),
		}}
	}

	var params *stripe.InvoiceParams
	if req.SubscriptionID != "" {
		params = &stripe.InvoiceParams{
			Customer:          stripe.String(req.CustomerID),
			Subscription:      stripe.String(req.SubscriptionID),
			SubscriptionItems: items,
		}
	} else {
		params = &stripe.InvoiceParams{
			Customer:          stripe.String(req.CustomerID),
			SubscriptionItems: items,
		}
	}

	in, err := invoice.GetNext(params)

	if err != nil {
		writeJSONErrorMessage(w, err.Error(), 422)
		log.Printf("invoice.GetNext: %v", err)
		return
	}

	// in the case where we are returning the upcoming invoice for a subscription change, calculate what the
	// invoice totals would be for the invoice we'll charge immediately when they confirm the change, and
	// also return the amount for the next period's invoice.

	if req.SubscriptionID == "" {
		writeJSON(w, struct {
			Invoice *stripe.Invoice `json:"invoice"`
		}{
			Invoice: in,
		})
		return
	}

	var immediateTotal int64
	var nextInvoiceSum int64
	for _, lineItem := range in.Lines.Data {
		if lineItem.Period.End == s.CurrentPeriodEnd {
			immediateTotal += lineItem.Amount
		} else {
			nextInvoiceSum += lineItem.Amount
		}
	}

	writeJSON(w, struct {
		ImmediateTotal int64           `json:"immediate_total"`
		NextInvoiceSum int64           `json:"next_invoice_sum"`
		Invoice        *stripe.Invoice `json:"invoice"`
	}{
		ImmediateTotal: immediateTotal,
		NextInvoiceSum: nextInvoiceSum,
		Invoice:        in,
	})
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
		writeJSONErrorMessage(w, err.Error(), 422)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	s, err := sub.Cancel(req.SubscriptionID, nil)

	if err != nil {
		writeJSONErrorMessage(w, err.Error(), 422)
		log.Printf("sub.Cancel: %v", err)
		return
	}

	writeJSON(w, s)
}

func handleUpdateSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		SubscriptionID string `json:"subscriptionId"`
		NewPriceID     string `json:"newPriceId"`
		Quantity       int64  `json:"quantity"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONErrorMessage(w, err.Error(), 422)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	s, err := sub.Get(req.SubscriptionID, nil)
	if err != nil {
		writeJSONErrorMessage(w, err.Error(), 422)
		log.Printf("sub.Get: %v", err)
		return
	}
	currentPriceID := s.Items.Data[0].Price.ID
	newPriceID := os.Getenv(req.NewPriceID)

	var params *stripe.SubscriptionParams

	if currentPriceID == newPriceID {
		params = &stripe.SubscriptionParams{
			Items: []*stripe.SubscriptionItemsParams{{
				ID:       stripe.String(s.Items.Data[0].ID),
				Quantity: stripe.Int64(req.Quantity),
			}},
		}
	} else {
		params = &stripe.SubscriptionParams{
			Items: []*stripe.SubscriptionItemsParams{{
				ID:      stripe.String(s.Items.Data[0].ID),
				Deleted: stripe.Bool(true),
			}, {
				Price:    stripe.String(newPriceID),
				Quantity: stripe.Int64(req.Quantity),
			}},
		}
	}
	params.AddExpand("plan.product")

	updatedSubscription, err := sub.Update(req.SubscriptionID, params)

	if err != nil {
		writeJSONErrorMessage(w, err.Error(), 422)
		log.Printf("sub.Update: %v", err)
		return
	}

	writeJSON(w, struct {
		Subscription *stripe.Subscription `json:"subscription"`
	}{
		Subscription: updatedSubscription,
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

func writeJSONError(w http.ResponseWriter, v interface{}, code int) {
	w.WriteHeader(code)
	writeJSON(w, v)
	return
}

func writeJSONErrorMessage(w http.ResponseWriter, message string, code int) {
	resp := &ErrorResponse{
		Error: &ErrorResponseMessage{
			Message: message,
		},
	}
	writeJSONError(w, resp, code)
}
