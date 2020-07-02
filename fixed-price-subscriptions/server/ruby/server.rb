# frozen_string_literal: true

require 'stripe'
require 'sinatra'
require 'dotenv'

# Replace if using a different env file or config
Dotenv.load
Stripe.api_key = ENV['STRIPE_SECRET_KEY']

set :static, true
set :public_folder, File.join(File.dirname(__FILE__), ENV['STATIC_DIR'])
set :port, 4242

get '/' do
  content_type 'text/html'
  send_file File.join(settings.public_folder, 'index.html')
end

get '/config' do
  content_type 'application/json'

  { 'publishableKey': ENV['STRIPE_PUBLISHABLE_KEY'] }.to_json
end

post '/create-customer' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  # Create a new customer object
  customer = Stripe::Customer.create(email: data['email'])

  { 'customer': customer }.to_json
end

post '/create-subscription' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  begin
    Stripe::PaymentMethod.attach(
      data['paymentMethodId'],
      { customer: data['customerId'] }
    )
  rescue Stripe::CardError => e
    halt 200,
         { 'Content-Type' => 'application/json' },
         { 'error': { message: e.error.message } }.to_json
  end

  # Set the default payment method on the customer
  Stripe::Customer.update(
    data['customerId'],
    invoice_settings: { default_payment_method: data['paymentMethodId'] }
  )

  # Create the subscription
  subscription =
    Stripe::Subscription.create(
      customer: data['customerId'],
      items: [{ price: ENV[data['priceId']] }],
      expand: %w[latest_invoice.payment_intent]
    )

  subscription.to_json
end

post '/retry-invoice' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  begin
    Stripe::PaymentMethod.attach(
      data['paymentMethodId'],
      { customer: data['customerId'] }
    )
  rescue Stripe::CardError => e
    halt 200,
         { 'Content-Type' => 'application/json' },
         { 'error': { message: e.error.message } }.to_json
  end

  # Set the default payment method on the customer
  Stripe::Customer.update(
    data['customerId'],
    invoice_settings: { default_payment_method: data['paymentMethodId'] }
  )

  invoice =
    Stripe::Invoice.retrieve(
      { id: data['invoiceId'], expand: %w[payment_intent] }
    )

  invoice.to_json
end

post '/retrieve-upcoming-invoice' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  subscription = Stripe::Subscription.retrieve(data['subscriptionId'])

  invoice =
    Stripe::Invoice.upcoming(
      customer: data['customerId'],
      subscription: data['subscriptionId'],
      subscription_items: [
        { id: subscription.items.data[0].id, deleted: true },
        { price: ENV[data['newPriceId']], deleted: false }
      ]
    )

  invoice.to_json
end

post '/cancel-subscription' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  deleted_subscription = Stripe::Subscription.delete(data['subscriptionId'])

  deleted_subscription.to_json
end

post '/update-subscription' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  subscription = Stripe::Subscription.retrieve(data['subscriptionId'])

  updated_subscription =
    Stripe::Subscription.update(
      data['subscriptionId'],
      cancel_at_period_end: false,
      items: [
        { id: subscription.items.data[0].id, price: ENV[data['newPriceId']] }
      ]
    )

  updated_subscription.to_json
end

post '/retrieve-customer-payment-method' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  payment_method = Stripe::PaymentMethod.retrieve(data['paymentMethodId'])

  payment_method.to_json
end

post '/stripe-webhook' do
  # You can use webhooks to receive information about asynchronous payment events.
  # For more about our webhook events check out https://stripe.com/docs/webhooks.
  webhook_secret = ENV['STRIPE_WEBHOOK_SECRET']
  payload = request.body.read
  if !webhook_secret.empty?
    # Retrieve the event by verifying the signature using the raw body and secret if webhook signing is configured.
    sig_header = request.env['HTTP_STRIPE_SIGNATURE']
    event = nil

    begin
      event =
        Stripe::Webhook.construct_event(payload, sig_header, webhook_secret)
    rescue JSON::ParserError => e
      # Invalid payload
      status 400
      return
    rescue Stripe::SignatureVerificationError => e
      # Invalid signature
      puts '⚠️  Webhook signature verification failed.'
      status 400
      return
    end
  else
    data = JSON.parse(payload, symbolize_names: true)
    event = Stripe::Event.construct_from(data)
  end
  # Get the type of webhook event sent - used to check the status of PaymentIntents.
  event_type = event['type']
  data = event['data']
  data_object = data['object']

  if event_type == 'invoice.paid'
    # Used to provision services after the trial has ended.
    # The status of the invoice will show up as paid. Store the status in your
    # database to reference when a user accesses your service to avoid hitting rate
    # limits.
    # puts data_object
  end

  if event_type == 'invoice.payment_failed'
    # If the payment fails or the customer does not have a valid payment method,
    # an invoice.payment_failed event is sent, the subscription becomes past_due.
    # Use this webhook to notify your user that their payment has
    # failed and to retrieve new card details.
    # puts data_object
  end

  if event_type == 'invoice.finalized'
    # If you want to manually send out invoices to your customers
    # or store them locally to reference to avoid hitting Stripe rate limits.
    # puts data_object
  end

  if event_type == 'customer.subscription.deleted'
    # handle subscription cancelled automatically based
    # upon your subscription settings. Or if the user cancels it.
    # puts data_object
  end

  if event_type == 'customer.subscription.trial_will_end'
    # Send notification to your user that the trial will end
    # puts data_object
  end

  content_type 'application/json'
  { status: 'success' }.to_json
end
