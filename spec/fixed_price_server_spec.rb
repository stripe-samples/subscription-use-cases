require 'byebug'

RSpec.describe "full integration path" do
  it "fetches the index route" do
    # Get the index html page
    response = get("/")
    expect(response).not_to be_nil
  end

  it "served config as expected" do
    resp = get_json("/config")
    expect(resp).to have_key("publishableKey")
  end

  describe "/create-customer" do
    it "creates a customer with the given email" do
      email = "jenny.rosen@example.com"
      resp, status = post_json("/create-customer", {
        email: email
      })
      expect(resp).to have_key("customer")
      expect(resp["customer"]).to have_key("id")
      expect(resp["customer"]["id"]).to start_with("cus_")
      expect(resp["customer"]["email"]).to eq(email)
    end
  end

  describe "/create-subscription" do
    it "attaches pm, sets default pm, creates sub successfully" do
      customer_id = Stripe::Customer.create.id
      pms_before = Stripe::PaymentMethod.list(
        type: 'card',
        customer: customer_id
      )
      resp, status = post_json("/create-subscription", {
        paymentMethodId: 'pm_card_visa',
        customerId: customer_id,
        priceId: 'BASIC',
      })

      # It attaches the payment method.
      pms_after = Stripe::PaymentMethod.list(
        type: 'card',
        customer: customer_id
      )
      expect(pms_after.data.length).to eq(pms_before.data.length + 1)

      # Sets default payment method
      customer_after = Stripe::Customer.retrieve(customer_id)
      expect(customer_after["invoice_settings"]["default_payment_method"]).to eq(
        pms_after.data.first.id
      )

      # Creates subscription
      expect(status).to eq(200)
      expect(resp).to have_key("id")
      expect(resp["id"]).to start_with("sub_")

      # Expands latest_invoice.payment_intent
      expect(resp).to have_key("latest_invoice")
      expect(resp["latest_invoice"]).to have_key("payment_intent")
      expect(resp["latest_invoice"]["payment_intent"]).to have_key("client_secret")
      expect(resp["latest_invoice"]["payment_intent"]["client_secret"]).to start_with("pi_")
    end

    it "fails to attach pm to customer and returns an error for bad cards" do
      customer_id = Stripe::Customer.create.id
      pms_before = Stripe::PaymentMethod.list(
        type: 'card',
        customer: customer_id
      )
      resp, status = post_json("/create-subscription", {
        paymentMethodId: 'pm_card_chargeDeclined',
        customerId: customer_id,
        priceId: 'BASIC',
      })

      # It attaches the payment method.
      pms_after = Stripe::PaymentMethod.list(
        type: 'card',
        customer: customer_id
      )
      expect(pms_after.data.length).to eq(pms_before.data.length)

      # Sets default payment method
      customer_after = Stripe::Customer.retrieve(customer_id)
      expect(customer_after["invoice_settings"]["default_payment_method"]).to be_nil


      # Assert error status
      # TODO: Make this a 400!
      expect(status).to eq(200)
      expect(resp).to have_key("error")
      expect(resp["error"]).to have_key("message")
      expect(resp["error"]["message"]).to start_with("Your card was declined.")
    end
  end

  describe "/retrieve-upcoming-invoice" do
    it "retrieves upcoming invoice for the customer" do
      customer_id = Stripe::Customer.create.id
      resp, _ = post_json("/create-subscription", {
        paymentMethodId: 'pm_card_mastercard',
        customerId: customer_id,
        priceId: 'BASIC',
      })
      subscription_id = resp["id"]
      items = resp.dig("items", "data")
      expect(items.length).to eq(1)
      old_price = items.first.dig("price", "id")

      # TODO: This should be a GET request.
      resp, status = post_json("/retrieve-upcoming-invoice", {
        subscriptionId: subscription_id,
        customerId: customer_id,
        newPriceId: 'PREMIUM',
      })
      expect(status).to eq(200)
      expect(resp).to have_key("status")
      expect(resp["status"]).to eq("draft")
      new_price = resp.dig("lines", "data", 0, "price")
      expect(new_price).not_to eq(old_price)
    end
  end

  describe "/cancel-subscription" do
    it "cancels the subscription" do
      customer_id = Stripe::Customer.create.id
      resp, _ = post_json("/create-subscription", {
        paymentMethodId: 'pm_card_mastercard',
        customerId: customer_id,
        priceId: 'BASIC',
      })
      subscription_id = resp["id"]
      resp, status = post_json("/cancel-subscription", {
        subscriptionId: subscription_id,
      })
      expect(status).to eq(200)
      expect(resp["status"]).to eq("canceled")
      expect(resp["id"]).to start_with("sub_")
    end
  end

  describe "/update-subscription" do
    it "changes the price on the subscription" do
      customer_id = Stripe::Customer.create.id
      resp, _ = post_json("/create-subscription", {
        paymentMethodId: 'pm_card_mastercard',
        customerId: customer_id,
        priceId: 'BASIC',
      })
      subscription_id = resp["id"]
      items = resp.dig("items", "data")
      expect(items.length).to eq(1)
      old_price = items.first.dig("price", "id")

      resp, status = post_json("/update-subscription", {
        subscriptionId: subscription_id,
        customerId: customer_id,
        newPriceId: 'PREMIUM',
      })
      expect(status).to eq(200)
      expect(resp).to have_key("object")
      expect(resp["object"]).to eq("subscription")
      new_price = resp.dig("items", "data", 0, "price")
      expect(new_price).not_to eq(old_price)
    end
  end

  describe "/retrieve-customer-payment-method" do
    it "retrieves the payment method" do
      customer_id = Stripe::Customer.create(
        payment_method: 'pm_card_visa'
      )
      pm = Stripe::PaymentMethod.list(customer: customer_id, type: 'card').data.first
      resp, status = post_json("/retrieve-customer-payment-method", {
        paymentMethodId: pm.id,
      })
      expect(status).to eq(200)
      expect(resp).to have_key("object")
      expect(resp).to have_key("id")
      expect(resp["id"]).to eq(pm.id)
      expect(resp["object"]).to eq("payment_method")
    end
  end
end
