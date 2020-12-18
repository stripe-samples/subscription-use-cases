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

  it "creates the subscription for a given customer" do
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

  end
end
