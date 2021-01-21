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
    "strings"

    "github.com/joho/godotenv"
    "github.com/stripe/stripe-go/v72"
    "github.com/stripe/stripe-go/v72/customer"
    "github.com/stripe/stripe-go/v72/invoice"
    "github.com/stripe/stripe-go/v72/paymentmethod"
    "github.com/stripe/stripe-go/v72/sub"
    "github.com/stripe/stripe-go/v72/webhook"
)

func main() {
    if err := godotenv.Load(); err != nil {
        log.Fatalf("godotenv.Load: %v", err)
    }

    stripe.Key = os.Getenv("STRIPE_SECRET_KEY")

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

    // You should store the ID of the customer in your database alongside your
    // users. This sample uses cookies to simulate auth.
    http.SetCookie(w, &http.Cookie{
        Name: "customer",
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
        PaymentMethodID string `json:"paymentMethodId"`
        PriceID         string `json:"priceLookupKey"`
    }

    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeJSON(w, nil, err)
        log.Printf("json.NewDecoder.Decode: %v", err)
        return
    }

    // Read customer from cookie to simulate auth
    cookie, _ := r.Cookie("customer")
    customerID := cookie.Value

    // Attach PaymentMethod
    params := &stripe.PaymentMethodAttachParams{
        Customer: stripe.String(customerID),
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

    // Create subscription
    subscriptionParams := &stripe.SubscriptionParams{
        DefaultPaymentMethod: stripe.String(pm.ID),
        Customer: stripe.String(customerID),
        Items: []*stripe.SubscriptionItemsParams{
            {
                Price: stripe.String(os.Getenv(strings.ToUpper(req.PriceID))),
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

    writeJSON(w, struct {
        Subscription *stripe.Subscription `json:"subscription"`
    }{
        Subscription: s,
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

    s, err := sub.Cancel(req.SubscriptionID, nil)

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

    s, err := sub.Get(subscriptionID, nil)
    if err != nil {
        writeJSON(w, nil, err)
        log.Printf("sub.Get: %v", err)
        return
    }
    params := &stripe.InvoiceParams{
        Customer:     stripe.String(customerID),
        Subscription: stripe.String(subscriptionID),
        SubscriptionItems: []*stripe.SubscriptionItemsParams{{
            ID:      stripe.String(s.Items.Data[0].ID),
            Price:   stripe.String(os.Getenv(newPriceLookupKey)),
        }},
    }
    in, err := invoice.GetNext(params)

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
        SubscriptionID string `json:"subscriptionId"`
        NewPriceLookupKey     string `json:"newPriceLookupKey"`
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
    s, err := sub.Get(req.SubscriptionID, nil)
    if err != nil {
        writeJSON(w, nil, err)
        log.Printf("sub.Get: %v", err)
        return
    }

    params := &stripe.SubscriptionParams{
        Items: []*stripe.SubscriptionItemsParams{{
            ID:    stripe.String(s.Items.Data[0].ID),
            Price: stripe.String(newPriceID),
        }},
    }

    updatedSubscription, err := sub.Update(req.SubscriptionID, params)

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
      Customer: customerID,
      Status: "all",
    }
    params.AddExpand("data.default_payment_method")
    i := sub.List(params)

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
