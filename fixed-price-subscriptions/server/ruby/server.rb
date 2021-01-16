# frozen_string_literal: true

require 'stripe'
require 'sinatra'
require 'sinatra/cookies'
require 'dotenv'
require './config_helper.rb'

# Replace if using a different env file or config
Dotenv.load
ConfigHelper.check_env!
Stripe.api_key = ENV['STRIPE_SECRET_KEY']

set :static, true
set :public_folder, File.join(File.dirname(__FILE__), ENV['STATIC_DIR'])
set :port, 4242

get '/' do
  content_type 'text/html'
  send_file File.join(settings.public_folder, 'register.html')
end

get '/config' do
  content_type 'application/json'

  { publishableKey: ENV['STRIPE_PUBLISHABLE_KEY'] }.to_json
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
  # `price_id` should be an ID of a Price object on your account.
  # In practice, you can also set a Price's `lookup_key` using
  # the API when you create a Price, then fetch the list of prices
  # by ID like so:
  #
  #   price_id = Stripe::Price.list(lookup_keys: ['basic']).data.first.id
  price_id = ENV[data['priceLookupKey'].upcase]

  begin
    # Attach the payment method to the customer related
    # to the authenticated user.
    payment_method = Stripe::PaymentMethod.attach(
      data['paymentMethodId'],
      customer: customer_id
    )
  rescue Stripe::CardError => e
    halt 400, { 'Content-Type' => 'application/json' }, { error: { message: e.error.message }}.to_json
  end

  # Create the subscription. Note we're using
  # expand here so that the API will return the Subscription's related
  # latest invoice, and that latest invoice's payment_intent so that
  # if SCA is required we can confirm the payment on the front end.
  subscription = Stripe::Subscription.create(
    default_payment_method: payment_method.id,
    customer: customer_id,
    items: [{
      price: price_id,
    }],
    expand: ['latest_invoice.payment_intent']
  )

  { subscription: subscription }.to_json
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
  deleted_subscription = Stripe::Subscription.delete(
    data['subscriptionId']
  )

  { subscription: deleted_subscription }.to_json
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
      price: ENV[data['newPriceId'].upcase]
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
