RSpec.describe "full integration path" do
  it "just works" do
    # Get the index html page
    response = get("/")
    expect(response).not_to be_nil

    # Get the config
    config, _ = get_json("/config")
    expect(config.keys).to contain_exactly("publishableKey")

    # Create the customer
    customer, _ = post_json("/create-customer", {
      email: "jenny.rosen@example.com",
    })
    expect(customer["customer"]["id"]).to start_with("cus_")
    customer_id = customer["customer"]["id"]

    # Create the subscription
    subscription, _ = post_json("/create-subscription", {
      customerId: customer_id,
      paymentMethodId: "pm_card_visa",
      priceId: "BASIC",
      quantity: 3,
    })
    expect(subscription).not_to be_nil
    expect(subscription["id"]).to start_with("sub_")
    expect(subscription["items"]["data"].length).to eq(1)
    expect(subscription["items"]["data"][0]["quantity"]).to eq(3)
    subscription_id = subscription["id"]

    # Create the subscription with a bad price
    error, status = post_json("/create-subscription", {
      customerId: customer_id,
      paymentMethodId: "pm_card_visa",
      priceId: "not-a-price",
      quantity: 3,
    })
    expect(status).to eq(422)
    expect(error).not_to be_nil
    expect(error.keys).to contain_exactly("error")
    expect(error["error"].keys).to contain_exactly("message")

    # Create the subscription with a bad card
    error, status = post_json("/create-subscription", {
      customerId: customer_id,
      paymentMethodId: "pm_card_chargeDeclinedIncorrectCvc",
      priceId: "BASIC",
      quantity: 3,
    })
    expect(status).to eq(422)
    expect(error).not_to be_nil
    expect(error.keys).to contain_exactly("error")
    expect(error["error"].keys).to contain_exactly("message")

    # Create the subscription with a card that attaches, but fails payment
    incomplete_subscription, status = post_json("/create-subscription", {
      customerId: customer_id,
      paymentMethodId: "pm_card_chargeCustomerFail",
      priceId: "BASIC",
      quantity: 3,
    })
    expect(status).to eq(200)
    expect(incomplete_subscription).not_to be_nil
    expect(incomplete_subscription["status"]).to eq("incomplete")
    expect(incomplete_subscription["latest_invoice"]["id"]).to start_with("in_")
    invoice_id = incomplete_subscription["latest_invoice"]["id"]

    # Create the subscription with a bad price
    invoice, status = post_json("/retry-invoice", {
      paymentMethodId: "pm_card_visa",
      customerId: customer_id,
      invoiceId: invoice_id,
    })
    expect(status).to eq(200)
    expect(invoice).not_to be_nil
    expect(invoice["id"]).to start_with("in_")

    # Get sub info
    sub_info, _ = post_json("/retrieve-subscription-information", {
      subscriptionId: subscription_id,
    })
    expect(sub_info.keys).to contain_exactly(
      "card",
      "product_description",
      "current_price",
      "current_quantity",
      "latest_invoice",
      "upcoming_invoice"
    )

    # Get upcoming invoice with new price
    upcoming_invoice, _ = post_json("/retrieve-upcoming-invoice", {
      customerId: customer_id,
      newPriceId: "PREMIUM",
      quantity: 3,
      subscriptionId: subscription_id
    })
    expect(upcoming_invoice).not_to be_nil
    expect(upcoming_invoice.keys).to contain_exactly("immediate_total", "next_invoice_sum", "invoice")

    # Get upcoming invoice with new quantity
    upcoming_invoice, _ = post_json("/retrieve-upcoming-invoice", {
      customerId: customer_id,
      newPriceId: "BASIC",
      quantity: 5,
      subscriptionId: subscription_id
    })
    expect(upcoming_invoice).not_to be_nil
    expect(upcoming_invoice.keys).to contain_exactly("immediate_total", "next_invoice_sum", "invoice")

    # Get upcoming invoice with out subscription
    upcoming_invoice, _ = post_json("/retrieve-upcoming-invoice", {
      customerId: customer_id,
      newPriceId: "BASIC",
      quantity: 5,
    })
    expect(upcoming_invoice).not_to be_nil
    expect(upcoming_invoice.keys).to contain_exactly("invoice")

    # Update subscription with new quantity
    updated_subscription, _ = post_json("/update-subscription", {
      customerId: customer_id,
      newPriceId: "BASIC",
      quantity: 5,
      subscriptionId: subscription_id
    })
    expect(updated_subscription).not_to be_nil
    expect(updated_subscription.keys).to contain_exactly("subscription")
    expect(updated_subscription["subscription"]["items"]["data"].length).to eq(1)
    expect(updated_subscription["subscription"]["items"]["data"][0]["quantity"]).to eq(5)

    # Update subscription with new price
    updated_subscription, _ = post_json("/update-subscription", {
      customerId: customer_id,
      newPriceId: "PREMIUM",
      quantity: 5,
      subscriptionId: subscription_id
    })
    expect(updated_subscription).not_to be_nil
    expect(updated_subscription.keys).to contain_exactly("subscription")

    # Cancel subscription
    subscription, _ = post_json("/cancel-subscription", {
      subscriptionId: subscription_id
    })
    expect(subscription).not_to be_nil
    expect(subscription["status"]).to eq("canceled")
  end
end
