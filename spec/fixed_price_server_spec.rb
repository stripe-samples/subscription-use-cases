require 'byebug'

def authenticated_post_json(path, payload, customer_id)
  post_json(path, payload, {
    cookies: {
      customer: customer_id
    }
  })
end

def authenticated_get_json(path, customer_id)
  get_json(path, {
    cookies: {
      customer: customer_id
    }
  })
end

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

      # Not using the post_json helper here, because we need access to cookies.
      response = RestClient.post(
        "#{server_url}/create-customer",
        { email: email }.to_json,
        { content_type: :json }
      )

      resp = JSON.parse(response.body)
      status = response.code

      expect(resp).to have_key("customer")
      expect(resp["customer"]).to have_key("id")
      expect(resp["customer"]["id"]).to start_with("cus_")
      expect(resp["customer"]["email"]).to eq(email)

      # Test simulated auth.
      expect(response.cookies).to have_key("customer")
      expect(response.cookies["customer"]).to eq(resp["customer"]["id"])
    end
  end

  describe "/create-subscription" do
    it "attaches pm and creates sub successfully" do
      customer_id = Stripe::Customer.create.id
      pms_before = Stripe::PaymentMethod.list(
        type: 'card',
        customer: customer_id
      )

      resp, status = authenticated_post_json("/create-subscription", {
        paymentMethodId: 'pm_card_visa',
        priceLookupKey: 'BASIC',
      }, customer_id)

      # It attaches the payment method.
      pms_after = Stripe::PaymentMethod.list(
        type: 'card',
        customer: customer_id
      )
      expect(pms_after.data.length).to eq(pms_before.data.length + 1)

      # Creates subscription
      expect(status).to eq(200)
      expect(resp).to have_key("subscription")
      subscription = resp["subscription"]
      expect(subscription).to have_key("id")
      expect(subscription["id"]).to start_with("sub_")

      # Sets default payment method
      if(subscription["default_payment_method"].is_a?(String))
        expect(subscription["default_payment_method"]).to eq(pms_after.data.first.id)
      else
        expect(subscription["default_payment_method"]["id"]).to eq(pms_after.data.first.id)
      end

      # Expands latest_invoice.payment_intent
      expect(subscription).to have_key("latest_invoice")
      expect(subscription["latest_invoice"]).to have_key("payment_intent")
      expect(subscription["latest_invoice"]["payment_intent"]).to have_key("client_secret")
      expect(subscription["latest_invoice"]["payment_intent"]["client_secret"]).to start_with("pi_")
    end

    it "fails to attach pm to customer and returns an error for bad cards" do
      customer_id = Stripe::Customer.create.id
      pms_before = Stripe::PaymentMethod.list(
        type: 'card',
        customer: customer_id
      )
      resp, status = authenticated_post_json("/create-subscription", {
        paymentMethodId: 'pm_card_chargeDeclined',
        priceLookupKey: 'BASIC',
      }, customer_id)

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
      expect(status).to eq(400)
      expect(resp).to have_key("error")
      expect(resp["error"]).to have_key("message")
      expect(resp["error"]["message"]).to start_with("Your card was declined.")
    end
  end

  describe "/invoice-preview" do
    it "retrieves upcoming invoice for the customer" do
      customer_id = Stripe::Customer.create.id
      resp, _ = authenticated_post_json("/create-subscription", {
        paymentMethodId: 'pm_card_mastercard',
        priceLookupKey: 'BASIC',
      }, customer_id)
      subscription_id = resp["subscription"]["id"]
      items = resp.dig("subscription", "items", "data")
      expect(items.length).to eq(1)
      old_price = items.first.dig("price", "id")

      resp = authenticated_get_json(
        "/invoice-preview?subscriptionId=#{subscription_id}&newPriceLookupKey=premium",
        customer_id
      )

      expect(resp).to have_key("invoice")
      invoice = resp["invoice"]

      expect(invoice).to have_key("status")
      expect(invoice["status"]).to eq("draft")
      new_price = invoice.dig("lines", "data", 0, "price")
      expect(new_price).not_to eq(old_price)
    end
  end

  describe "/cancel-subscription" do
    it "cancels the subscription" do
      customer_id = Stripe::Customer.create.id
      resp, _ = authenticated_post_json("/create-subscription", {
        paymentMethodId: 'pm_card_mastercard',
        priceLookupKey: 'BASIC',
      }, customer_id)
      subscription_id = resp["subscription"]["id"]
      resp, status = post_json("/cancel-subscription", {
        subscriptionId: subscription_id,
      })
      expect(status).to eq(200)
      expect(resp["subscription"]["status"]).to eq("canceled")
      expect(resp["subscription"]["id"]).to start_with("sub_")
    end
  end

  describe "/update-subscription" do
    it "changes the price on the subscription" do
      customer_id = Stripe::Customer.create.id
      resp, _ = authenticated_post_json("/create-subscription", {
        paymentMethodId: 'pm_card_mastercard',
        priceLookupKey: 'BASIC',
      }, customer_id)
      subscription = resp["subscription"]
      subscription_id = subscription["id"]
      items = subscription.dig("items", "data")
      expect(items.length).to eq(1)
      old_price = items.first.dig("price", "id")

      resp, status = post_json("/update-subscription", {
        subscriptionId: subscription_id,
        newPriceId: 'PREMIUM',
      })
      expect(status).to eq(200)
      expect(subscription).to have_key("object")
      expect(subscription["object"]).to eq("subscription")
      new_price = resp.dig("items", "data", 0, "price")
      expect(new_price).not_to eq(old_price)
    end
  end
end
