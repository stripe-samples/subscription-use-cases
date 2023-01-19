# frozen_string_literal: true
require 'stripe'
require 'sinatra'
require 'sinatra/cookies'
require 'dotenv'
require './config_helper.rb'

# Replace if using a different env file or config
Dotenv.load
ConfigHelper.check_env!

# For sample support and debugging, not required for production:
Stripe.set_app_info(
  'stripe-samples/subscription-use-cases/fixed-price',
  version: '0.0.2',
  url: 'https://github.com/stripe-samples/subscription-use-cases/fixed-price'
)
Stripe.api_version = '2022-08-01'
Stripe.api_key = ENV['STRIPE_SECRET_KEY']

set :static, true
set :public_folder, File.join(File.dirname(__FILE__), ENV['STATIC_DIR'])
set :port, 4242
set :bind, '0.0.0.0'

get '/' do
  content_type 'text/html'
  send_file File.join(settings.public_folder, 'register.html')
end

get '/config' do
  content_type 'application/json'
  # Retrieves two prices with the lookup_keys
  # `sample_basic` and `sample_premium`.  To
  # create these prices, you can use the Stripe
  # CLI fixtures command with the supplied
  # `seed.json` fixture file like so:
  #
  #    stripe fixtures seed.json
  #

  # Use Price's `lookup_key` using to fetch the list of prices
  prices = Stripe::Price.list({
    lookup_keys: ['sample_basic', 'sample_premium']
  })

  {
    publishableKey: ENV['STRIPE_PUBLISHABLE_KEY'],
    prices: prices.data
  }.to_json
end

post '/create-customer' do
  content_type 'application/json'
  data = JSON.parse(request.body.read)

  # Create a new customer object
  customer = Stripe::Customer.create(email: data['email'])

  # Simulate authentication
  cookies[:customer] = customer.id

  { customer: customer }.to_json
end

post '/create-subscription' do
  content_type 'application/json'
  data = JSON.parse(request.body.read)

  # Look up the authenticated customer in your database
  # this sample uses cookies to simulate a logged in user.
  customer_id = cookies[:customer]

  # Extract the price ID from environment variables given the name
  # of the price passed from the front end.
  #
  # `price_id` is the an ID of a Price object on your account.
  # This was populated using Price's `lookup_key` in the /config endpoint
  price_id = data['priceId']

  # Create the subscription. Note we're using
  # expand here so that the API will return the Subscription's related
  # latest invoice, and that latest invoice's payment_intent
  # so we can collect payment information and confirm the payment on the front end.
  subscription = Stripe::Subscription.create(
    customer: customer_id,
    items: [{
      price: price_id,
    }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent']
  )

  { subscriptionId: subscription.id, clientSecret: subscription.latest_invoice.payment_intent.client_secret }.to_json
end

get '/subscriptions' do
  content_type 'application/json'

  # Lookup the Stripe ID for the currently logged in user.  We're simulating
  # authentication by storing the customer's ID in a cookie.
  customer_id = cookies[:customer]

  # Fetches subscriptions for the current user to display on the /account.html
  # page.  We expand `data.default_payment_method` to display the last4.
  subscriptions = Stripe::Subscription.list(
    customer: customer_id,
    status: 'all',
    expand: ['data.default_payment_method'],
  )

  { subscriptions: subscriptions }.to_json
end

post '/cancel-subscription' do
  content_type 'application/json'
  data = JSON.parse(request.body.read)

  # Be sure to only cancel subscriptions of the logged in user.
  # This naiively assumes the subscriptionId belongs to the
  # authenticated user.
  canceled_subscription = Stripe::Subscription.cancel(
    data['subscriptionId']
  )

  { subscription: canceled_subscription }.to_json
end

post '/update-subscription' do
  content_type 'application/json'
  data = JSON.parse(request.body.read)

  # We're retrieving the Subscription first so that we have the subscription
  # item ID. In practice, you might want to store the subscription item ID in
  # your database along side the subscription so that you can avoid this API
  # call.
  subscription = Stripe::Subscription.retrieve(data['subscriptionId'])

  updated_subscription = Stripe::Subscription.update(
    data['subscriptionId'],
    items: [{
      id: subscription.items.data[0].id,
      price: ENV[data['newPriceLookupKey'].upcase]
    }]
  )

  { subscription: updated_subscription }.to_json
end

get '/invoice-preview' do
  content_type 'application/json'

  # Simulated authentication with cookie.
  customer_id = cookies[:customer]

  # Fetch the subscription so that we have the subscription item ID
  # we're updating.
  subscription = Stripe::Subscription.retrieve(params['subscriptionId'])

  invoice = Stripe::Invoice.upcoming(
    customer: customer_id,
    subscription: params['subscriptionId'],
    subscription_items: [{
      id: subscription.items.data[0].id,
      price: ENV[params['newPriceLookupKey'].upcase],
    }]
  )

  { invoice: invoice }.to_json
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

  data = event['data']
  data_object = data['object']

  if event.type == 'invoice.payment_succeeded'
    if data_object['billing_reason'] == 'subscription_create'
      # The subscription automatically activates after successful payment
      # Set the payment method used to pay the first invoice
      # as the default payment method for that subscription
      subscription_id = data_object['subscription']
      payment_intent_id = data_object['payment_intent']

      # Retrieve the payment intent used to pay the subscription
      payment_intent = Stripe::PaymentIntent.retrieve(payment_intent_id)

      # Set the default payment method
      Stripe::Subscription.update(subscription_id, default_payment_method: payment_intent.payment_method)

      puts "Default payment method set for subscription: #{payment_intent.payment_method}"
    end

    puts "Payment succeeded for invoice: #{event.id}"
  end

  if event.type == 'invoice.paid'
    # Used to provision services after the trial has ended.
    # The status of the invoice will show up as paid. Store the status in your
    # database to reference when a user accesses your service to avoid hitting rate
    # limits.
    # puts data_object
    puts "Invoice paid: #{event.id}"
  end

  if event.type == 'invoice.payment_failed'
    # If the payment fails or the customer does not have a valid payment method,
    # an invoice.payment_failed event is sent, the subscription becomes past_due.
    # Use this webhook to notify your user that their payment has
    # failed and to retrieve new card details.
    # puts data_object
    puts "Invoice payment failed: #{event.id}"
  end

  if event.type == 'invoice.finalized'
    # If you want to manually send out invoices to your customers
    # or store them locally to reference to avoid hitting Stripe rate limits.
    # puts data_object
    puts "Invoice finalized: #{event.id}"
  end

  if event.type == 'customer.subscription.deleted'
    # handle subscription cancelled automatically based
    # upon your subscription settings. Or if the user cancels it.
    # puts data_object
    puts "Subscription canceled: #{event.id}"
  end

  content_type 'application/json'
  { status: 'success' }.to_json
end
