# frozen_string_literal: true

require 'stripe'
require 'sinatra'
require 'dotenv'

# Replace if using a different env file or config
Dotenv.load

# For sample support and debugging, not required for production:
Stripe.set_app_info(
  'stripe-samples/subscription-use-cases/usage-based-subscriptions',
  version: '0.0.1',
  url: 'https://github.com/stripe-samples/subscription-use-cases/usage-based-subscriptions'
)
Stripe.api_version = '2022-08-01'
Stripe.api_key = ENV['STRIPE_SECRET_KEY']

client = Stripe::StripeClient.new(ENV['STRIPE_SECRET_KEY'])

set :static, true
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

  begin
    # Create a new customer object
    customer = Stripe::Customer.create({ email: data['email'], name: data['name'] })

    { 'customer': customer }.to_json
  rescue Stripe::StripeError => e
    halt 400,
         { 'Content-Type' => 'application/json' },
         { 'error': { message: e.error.message } }.to_json
  end
end

post '/create-meter' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  begin
    # Create a new meter object
    meter = Stripe::Billing::Meter.create(
      {
        display_name: data['displayName'],
        event_name: data['eventName'],
        default_aggregation: {
          formula: data['aggregationFormula']
        }
      }
    )

    { 'meter': meter }.to_json
  rescue Stripe::StripeError => e
    halt 400,
         { 'Content-Type' => 'application/json' },
         { 'error': { message: e.error.message } }.to_json
  end
end

post '/create-price' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  begin
    # Create a new price object
    price = Stripe::Price.create(
      {
        currency: data['currency'],
        unit_amount: data['amount'],
        recurring: {
          interval: 'month',
          meter: data['meterId'],
          usage_type: 'metered'
        },
        product_data: {
          name: data['productName']
        }
      }
    )

    { 'price': price }.to_json
  rescue Stripe::StripeError => e
    halt 400,
         { 'Content-Type' => 'application/json' },
         { 'error': { message: e.error.message } }.to_json
  end
end

post '/create-subscription' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  begin
    subscription = Stripe::Subscription.create(
      {
        customer: data['customerId'],
        items: [{ price: data['priceId'] }],
        expand: ['pending_setup_intent']
      }
    )

    { 'subscription': subscription }.to_json
  rescue Stripe::StripeError => e
    halt 200,
         { 'Content-Type' => 'application/json' },
         { 'error': { message: e.error.message } }.to_json
  end
end

post '/create-meter-event' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  begin
    meter_event = client.v2.billing.meter_events.create(
      {
        event_name: data['eventName'],
        payload: {
          value: (data['value']).to_s,
          stripe_customer_id: data['customerId']
        }
      }
    )

    { 'meterEvent': meter_event }.to_json
  rescue Stripe::StripeError => e
    halt 200,
         { 'Content-Type' => 'application/json' },
         { 'error': { message: e.error.message } }.to_json
  end
end

post '/webhook' do
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
