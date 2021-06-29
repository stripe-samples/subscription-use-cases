def authenticated_post_json(path, payload, customer_id)
  post_json(path, payload, cookies: {customer: customer_id})
end

def authenticated_get_json(path, customer_id)
  get_json(path, cookies: {customer: customer_id})
end

def create_and_confirm_subscription(customer_id, price_id)
  resp, _ = authenticated_post_json("/create-subscription", {
    priceId: price_id
  }, customer_id)
  subscription_id = resp["subscriptionId"]
  subscription = Stripe::Subscription.retrieve(id: subscription_id, expand: ['latest_invoice.payment_intent'])
  Stripe::PaymentIntent.confirm(subscription.latest_invoice.payment_intent.id, {
    payment_method: 'pm_card_visa',
  })
  subscription
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
    expect(resp).to have_key("prices")
    expect(resp["prices"]).not_to be_empty
    expect(resp["prices"][0]["id"]).to start_with("price_")
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
    it "Creates the subscription and returrns a client secret" do
      customer_id = Stripe::Customer.create.id
      price_id = get_json("/config")["prices"][0]["id"]

      resp, status = authenticated_post_json("/create-subscription", {
        priceId: price_id,
      }, customer_id)

      # Creates subscription
      expect(status).to eq(200)
      expect(resp).to have_key("subscriptionId")
      subscription_id = resp["subscriptionId"]

      # Returns the latest invoice's payemnt intent's client_secret
      expect(resp).to have_key("clientSecret")
      expect(resp["clientSecret"]).to start_with("pi_")
    end
  end

  describe '/subscriptions' do
    it 'retrieves all subscriptions for the customer' do
      customer_id = Stripe::Customer.create.id
      price_id = get_json("/config")["prices"][0]["id"]

      # Create a subscription
      resp, _ = authenticated_post_json("/create-subscription", {
        priceId: price_id,
      }, customer_id)
      sub1 = resp['subscription']

      # Create then cancel another subscription for the
      # same customer.
      resp, _ = authenticated_post_json("/create-subscription", {
        priceId: price_id,
      }, customer_id)
      sub2_id = resp['subscriptionId']
      resp, _ = authenticated_post_json("/cancel-subscription", {
        subscriptionId: sub2_id,
      }, customer_id)

      # Now fetch the list of subscriptions for the customer
      # given they now have one active and one canceled.
      resp = authenticated_get_json("/subscriptions", customer_id)
      expect(resp['subscriptions']['data'].length).to eq(2)
    end
  end

  describe "/cancel-subscription" do
    it "cancels the subscription" do
      customer_id = Stripe::Customer.create.id
      price_id = get_json("/config")["prices"][0]["id"]
      subscription = create_and_confirm_subscription(customer_id, price_id)

      resp, status = post_json("/cancel-subscription", {
        subscriptionId: subscription.id,
      })
      expect(status).to eq(200)
      expect(resp["subscription"]["status"]).to eq("canceled")
      expect(resp["subscription"]["id"]).to start_with("sub_")
    end
  end

  describe "/update-subscription" do
    it "changes the price on the subscription" do
      customer_id = Stripe::Customer.create.id
      prices = get_json("/config")["prices"]
      price1_id = prices[0]["id"]
      price2_id = prices[1]["id"]
      subscription = create_and_confirm_subscription(customer_id, price1_id)
      items = subscription.items.data
      expect(items.length).to eq(1)
      old_price = items.first.price.id

      resp, status = post_json("/update-subscription", {
        subscriptionId: subscription.id,
        newPriceLookupKey: 'premium',
      })

      expect(status).to eq(200)
      items = Stripe::Subscription.retrieve(subscription.id).items.data
      expect(items.length).to eq(1)
      new_price = items.first.price.id
      expect(new_price).not_to eq(old_price)
    end
  end

  describe "/invoice-preview" do
    it "retrieves upcoming invoice for the customer" do
      customer_id = Stripe::Customer.create.id
      old_price = get_json("/config")["prices"][0]["id"]
      subscription = create_and_confirm_subscription(customer_id, old_price)

      resp = authenticated_get_json(
        "/invoice-preview?subscriptionId=#{subscription.id}&newPriceLookupKey=premium",
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
end
