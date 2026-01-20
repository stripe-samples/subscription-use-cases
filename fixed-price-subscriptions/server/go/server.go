package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"github.com/stripe/stripe-go/v84"
	"github.com/stripe/stripe-go/v84/customer"
	"github.com/stripe/stripe-go/v84/invoice"
	"github.com/stripe/stripe-go/v84/paymentintent"
	"github.com/stripe/stripe-go/v84/price"
	"github.com/stripe/stripe-go/v84/subscription"
	"github.com/stripe/stripe-go/v84/webhook"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Fatalf("godotenv.Load: %v", err)
	}

	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")
	// For sample support and debugging, not required for production:
	stripe.SetAppInfo(&stripe.AppInfo{
		Name:    "stripe-samples/subscription-use-cases/fixed-price",
		Version: "0.0.1",
		URL:     "https://github.com/stripe-samples/subscription-use-cases/fixed-price",
	})

	http.Handle("/", http.FileServer(http.Dir(os.Getenv("STATIC_DIR"))))
	http.HandleFunc("/config", handleConfig)
	http.HandleFunc("/create-customer", handleCreateCustomer)
	http.HandleFunc("/create-subscription", handleCreateSubscription)
	http.HandleFunc("/cancel-subscription", handleCancelSubscription)
	http.HandleFunc("/update-subscription", handleUpdateSubscription)
	http.HandleFunc("/invoice-preview", handleInvoicePreview)
	http.HandleFunc("/subscriptions", handleListSubscriptions)
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

	params := &stripe.PriceListParams{
		LookupKeys: stripe.StringSlice([]string{"sample_basic", "sample_premium"}),
	}

	prices := make([]*stripe.Price, 0)

	i := price.List(params)
	for i.Next() {
		prices = append(prices, i.Price())
	}

	writeJSON(w, struct {
		PublishableKey string          `json:"publishableKey"`
		Prices         []*stripe.Price `json:"prices"`
	}{
		PublishableKey: os.Getenv("STRIPE_PUBLISHABLE_KEY"),
		Prices:         prices,
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

	// You should store the ID of the customer in your database alongside your
	// users. This sample uses cookies to simulate auth.
	http.SetCookie(w, &http.Cookie{
		Name:  "customer",
		Value: c.ID,
	})

	writeJSON(w, struct {
		Customer *stripe.Customer `json:"customer"`
	}{
		Customer: c,
	}, nil)
}

func handleCreateSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		PriceID string `json:"priceId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, nil, err)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	// Read customer from cookie to simulate auth
	cookie, _ := r.Cookie("customer")
	customerID := cookie.Value

	// Create subscription
	subscriptionParams := &stripe.SubscriptionParams{
		Customer: stripe.String(customerID),
		Items: []*stripe.SubscriptionItemsParams{
			{
				Price: stripe.String(req.PriceID),
			},
		},
		PaymentBehavior: stripe.String("default_incomplete"),
	}
	subscriptionParams.AddExpand("latest_invoice.payments.data.payment")
	s, err := subscription.New(subscriptionParams)

	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("sub.New: %v", err)
		return
	}

	// Get the PaymentIntent ID from the payments collection and retrieve it separately
	paymentIntentID := s.LatestInvoice.Payments.Data[0].Payment.PaymentIntent.ID
	pi, err := paymentintent.Get(paymentIntentID, nil)
	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("paymentintent.Get: %v", err)
		return
	}

	writeJSON(w, struct {
		SubscriptionID string `json:"subscriptionId"`
		ClientSecret   string `json:"clientSecret"`
	}{
		SubscriptionID: s.ID,
		ClientSecret:   pi.ClientSecret,
	}, nil)
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

	s, err := subscription.Cancel(req.SubscriptionID, nil)

	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("sub.Cancel: %v", err)
		return
	}

	writeJSON(w, struct {
		Subscription *stripe.Subscription `json:"subscription"`
	}{
		Subscription: s,
	}, nil)
}

func handleInvoicePreview(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	// Read customer from cookie to simulate auth
	cookie, _ := r.Cookie("customer")
	customerID := cookie.Value

	query := r.URL.Query()
	subscriptionID := query.Get("subscriptionId")
	newPriceLookupKey := strings.ToUpper(query.Get("newPriceLookupKey"))

	s, err := subscription.Get(subscriptionID, nil)
	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("subscription.Get: %v", err)
		return
	}
	params := &stripe.InvoiceCreatePreviewParams{
		Customer:     stripe.String(customerID),
		Subscription: stripe.String(subscriptionID),
		SubscriptionDetails: &stripe.InvoiceCreatePreviewSubscriptionDetailsParams{
			Items: []*stripe.InvoiceCreatePreviewSubscriptionDetailsItemParams{{
				ID:    stripe.String(s.Items.Data[0].ID),
				Price: stripe.String(os.Getenv(newPriceLookupKey)),
			}},
		},
	}
	in, err := invoice.CreatePreview(params)

	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("invoice.GetNext: %v", err)
		return
	}

	writeJSON(w, struct {
		Invoice *stripe.Invoice `json:"invoice"`
	}{
		Invoice: in,
	}, nil)
}

func handleUpdateSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		SubscriptionID    string `json:"subscriptionId"`
		NewPriceLookupKey string `json:"newPriceLookupKey"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, nil, err)
		log.Printf("json.NewDecoder.Decode: %v", err)
		return
	}

	// This is the ID of the Stripe Price object to which the subscription
	// will be upgraded or downgraded.
	newPriceID := os.Getenv(strings.ToUpper(req.NewPriceLookupKey))

	// Fetch the subscription to access the related subscription item's ID
	// that will be updated. In practice, you might want to store the
	// Subscription Item ID in your database to avoid this API call.
	s, err := subscription.Get(req.SubscriptionID, nil)
	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("subscription.Get: %v", err)
		return
	}

	params := &stripe.SubscriptionParams{
		Items: []*stripe.SubscriptionItemsParams{{
			ID:    stripe.String(s.Items.Data[0].ID),
			Price: stripe.String(newPriceID),
		}},
	}

	updatedSubscription, err := subscription.Update(req.SubscriptionID, params)

	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("sub.Update: %v", err)
		return
	}

	writeJSON(w, struct {
		Subscription *stripe.Subscription `json:"subscription"`
	}{
		Subscription: updatedSubscription,
	}, nil)

}

func handleListSubscriptions(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	// Read customer from cookie to simulate auth
	cookie, _ := r.Cookie("customer")
	customerID := cookie.Value

	params := &stripe.SubscriptionListParams{
		Customer: stripe.String(customerID),
		Status:   stripe.String("all"),
	}
	params.AddExpand("data.default_payment_method")
	i := subscription.List(params)

	writeJSON(w, struct {
		Subscriptions *stripe.SubscriptionList `json:"subscriptions"`
	}{
		Subscriptions: i.SubscriptionList(),
	}, nil)
}

func handleWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	b, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("io.ReadAll: %v", err)
		return
	}

	event, err := webhook.ConstructEvent(b, r.Header.Get("Stripe-Signature"), os.Getenv("STRIPE_WEBHOOK_SECRET"))
	if err != nil {
		writeJSON(w, nil, err)
		log.Printf("webhook.ConstructEvent: %v", err)
		return
	}

	if event.Type == "invoice.payment_succeeded" {
		var inv stripe.Invoice
		err := json.Unmarshal(event.Data.Raw, &inv)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing webhook JSON: %v\n", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// Get payment intent from the payments collection
		if len(inv.Payments.Data) > 0 && inv.Payments.Data[0].Payment != nil {
			pi, _ := paymentintent.Get(
				inv.Payments.Data[0].Payment.PaymentIntent.ID,
				nil,
			)

			// Get subscription ID from parent
			if inv.Parent != nil && inv.Parent.SubscriptionDetails != nil {
				params := &stripe.SubscriptionParams{
					DefaultPaymentMethod: stripe.String(pi.PaymentMethod.ID),
				}
				subscription.Update(inv.Parent.SubscriptionDetails.Subscription.ID, params)
				fmt.Println("Default payment method set for subscription: ", pi.PaymentMethod)
			}
		}
	}
	fmt.Println("Payment succeeded for invoice: ", event.ID)
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
		w.WriteHeader(http.StatusBadRequest)
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
