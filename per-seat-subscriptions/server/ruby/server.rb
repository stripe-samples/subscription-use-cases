# frozen_string_literal: true

require 'stripe'
require 'sinatra'
require 'sinatra/reloader' if development?
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
  send_file File.join(settings.public_folder, 'index.html')
end

get '/config' do
  content_type 'application/json'

  { 'publishableKey': ENV['STRIPE_PUBLISHABLE_KEY'] }.to_json
end

# Returns information about the subscription and payment method used to display on the account page.
post '/retrieve-subscription-information' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  subscriptionId = data['subscriptionId']
  subscription = Stripe::Subscription.retrieve(
    id: subscriptionId,
    expand: %w[
      latest_invoice
      customer.invoice_settings.default_payment_method
      items.data.price.product
    ]
  )

  upcoming_invoice = Stripe::Invoice.upcoming(subscription: subscriptionId)

  item = subscription.items.first
  {
    card: subscription.customer.invoice_settings.default_payment_method.card,
    product_description: item.price.product.name,
    current_price: item.price.id,
    current_quantity: item.quantity,
    latest_invoice: subscription.latest_invoice,
    upcoming_invoice: upcoming_invoice
  }.to_json
end

post '/create-customer' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  # Create a new customer object
  customer = Stripe::Customer.create(email: data['email'])

  { 'customer': customer }.to_json
end

# Create a subscription.  This method first attaches the provided payment method to a customer object
# and then creates a subscription for that customer using the supplied price and quantity parameters.
post '/create-subscription' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  begin
    payment_method = Stripe::PaymentMethod.attach(
      data['paymentMethodId'],
      customer: data['customerId']
    )

    # Set the default payment method on the customer
    Stripe::Customer.update(
      data['customerId'],
      invoice_settings: {
        default_payment_method: payment_method.id,
      }
    )

    # Create the subscription
    subscription = Stripe::Subscription.create(
      customer: data['customerId'],
      items: [{ price: ENV[data['priceId']], quantity: data['quantity'] }],
      expand: %w[latest_invoice.payment_intent plan.product]
    )

    subscription.to_json
  rescue Stripe::StripeError => e
    halt 400,
         { 'Content-Type' => 'application/json' },
         { 'error': { message: e.error.message } }.to_json
  end
end

post '/retry-invoice' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  begin
    payment_method = Stripe::PaymentMethod.attach(
      data['paymentMethodId'],
      { customer: data['customerId'] }
    )

    # Set the default payment method on the customer
    Stripe::Customer.update(
      data['customerId'],
      invoice_settings: {
        default_payment_method: payment_method.id,
      },
    )

    invoice = Stripe::Invoice.retrieve(
      id: data['invoiceId'],
      expand: ['payment_intent']
    )
  rescue Stripe::StripeError => e
    halt 400,
      { 'Content-Type' => 'application/json' },
      { 'error': { message: e.error.message } }.to_json
  end
  invoice.to_json
end

post '/retrieve-upcoming-invoice' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  new_price = ENV[data['newPriceId'].upcase]
  quantity = data['quantity']

  params = {}
  params[:customer] = data['customerId']

  if !data['subscriptionId'].nil?
    subscription = Stripe::Subscription.retrieve(data['subscriptionId'])
    params[:subscription] = data['subscriptionId']

    # compare the current price to the new price, and only create a new subscription if they are different
    # otherwise, just add seats to the existing subscription
    # subscription.plan.id would also work

    current_price = subscription.items.data[0].price.id

    params[:subscription_items] =
      if current_price == new_price
        [{ id: subscription.items.data[0].id, quantity: quantity }]
      else
        [
          { id: subscription.items.data[0].id, deleted: true },
          { price: new_price, quantity: quantity }
        ]
      end
  else
    params[:subscription_items] = [{ price: new_price, quantity: quantity }]
  end

  invoice = Stripe::Invoice.upcoming(params)

  response = {}

  # in the case where we are returning the upcoming invoice for a subscription change, calculate what the
  # invoice totals would be for the invoice we'll charge immediately when they confirm the change, and
  # also return the amount for the next period's invoice.
  if !subscription.nil?
    current_period_end = subscription.current_period_end
    immediate_total = 0
    next_invoice_sum = 0

    invoice.lines.data.each do |invoiceLineItem|
      if invoiceLineItem.period.end == current_period_end
        immediate_total += invoiceLineItem.amount
      else
        next_invoice_sum += invoiceLineItem.amount
      end
    end
    response = {
      immediate_total: immediate_total,
      next_invoice_sum: next_invoice_sum,
      invoice: invoice
    }
  else
    response = { invoice: invoice }
  end

  response.to_json
end

post '/cancel-subscription' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  deleted_subscription = Stripe::Subscription.delete(data['subscriptionId'])

  deleted_subscription.to_json
end

# The update may just involve updating the quantity of the subscription, or it may mean changing the price.
post '/update-subscription' do
  content_type 'application/json'
  data = JSON.parse request.body.read

  subscription = Stripe::Subscription.retrieve(data['subscriptionId'])
  current_price = subscription.items.data[0].price.id
  new_price = ENV[data['newPriceId']]
  quantity = data['quantity']

  updated_subscription = subscription

  if current_price == new_price
    updated_subscription =
      Stripe::Subscription.update(
        data['subscriptionId'],
        items: [{ id: subscription.items.data[0].id, quantity: quantity }],
        expand: %w[plan.product]
      )
  else
    updated_subscription =
      Stripe::Subscription.update(
        data['subscriptionId'],
        items: [
          { id: subscription.items.data[0].id, deleted: true },
          { price: new_price, quantity: data['quantity'] }
        ],
        expand: %w[plan.product]
      )
  end

  # invoice and charge the customer immediately for the payment representing any balance that the customer accrued
  # as a result of the change.  For example, if the user added seats for this month, this would charge the proration amount for those
  # extra seats for the remaining part of the month.

  invoice =
    Stripe::Invoice.pay(
      Stripe::Invoice.create(
        {
          customer: subscription.customer,
          subscription: subscription.id,
          description:
            'Change to #{quantity} seat(s) on the #{updated_subscription.plan.product.name} plan'
        }
      ).id
    )

  { subscription: updated_subscription }.to_json
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
