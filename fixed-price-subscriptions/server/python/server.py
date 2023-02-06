#! /usr/bin/env python3.6
"""
Python 3.6 or newer required.
"""
import stripe
import json
import os

from flask import Flask, render_template, jsonify, request
from dotenv import load_dotenv, find_dotenv

# Setup Stripe python client library
load_dotenv(find_dotenv())

# For sample support and debugging, not required for production:
stripe.set_app_info(
    'stripe-samples/subscription-use-cases/fixed-price',
    version='0.0.1',
    url='https://github.com/stripe-samples/subscription-use-cases/fixed-price')

stripe.api_version = '2022-08-01'
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

static_dir = str(os.path.abspath(os.path.join(__file__, "..", os.getenv("STATIC_DIR"))))
app = Flask(__name__, static_folder=static_dir, static_url_path="", template_folder=static_dir)


@app.route('/', methods=['GET'])
def get_index():
    return render_template('register.html')


@app.route('/config', methods=['GET'])
def get_config():
    # Retrieves two prices with the lookup_keys
    # `sample_basic` and `sample_premium`.  To
    # create these prices, you can use the Stripe
    # CLI fixtures command with the supplied
    # `seed.json` fixture file like so:
    #
    #    stripe fixtures seed.json
    #

    prices = stripe.Price.list(
        lookup_keys=['sample_basic', 'sample_premium']
    )

    return jsonify(
        publishableKey=os.getenv('STRIPE_PUBLISHABLE_KEY'),
        prices=prices.data,
    )


@app.route('/create-customer', methods=['POST'])
def create_customer():
    # Reads application/json and returns a response
    data = json.loads(request.data)
    try:
        # Create a new customer object
        customer = stripe.Customer.create(email=data['email'])

        # At this point, associate the ID of the Customer object with your
        # own internal representation of a customer, if you have one.
        resp = jsonify(customer=customer)

        # We're simulating authentication here by storing the ID of the customer
        # in a cookie.
        resp.set_cookie('customer', customer.id)

        return resp
    except Exception as e:
        return jsonify(error=str(e)), 403


@app.route('/create-subscription', methods=['POST'])
def create_subscription():
    data = json.loads(request.data)

    # Simulating authenticated user. Lookup the logged in user in your
    # database, and set customer_id to the Stripe Customer ID of that user.
    customer_id = request.cookies.get('customer')

    # Extract the price ID from environment variables given the name
    # of the price passed from the front end.
    #
    # `price_id` is the an ID of a Price object on your account.
    # This was populated using Price's `lookup_key` in the /config endpoint
    price_id = data['priceId']

    try:
        # Create the subscription. Note we're using
        # expand here so that the API will return the Subscription's related
        # latest invoice, and that latest invoice's payment_intent
        # so we can collect payment information and confirm the payment on the front end.

        # Create the subscription
        subscription = stripe.Subscription.create(
            customer=customer_id,
            items=[{
                'price': price_id,
            }],
            payment_behavior='default_incomplete',
            expand=['latest_invoice.payment_intent'],
        )
        return jsonify(subscriptionId=subscription.id, clientSecret=subscription.latest_invoice.payment_intent.client_secret)

    except Exception as e:
        return jsonify(error={'message': e.user_message}), 400


@app.route('/cancel-subscription', methods=['POST'])
def cancel_subscription():
    data = json.loads(request.data)
    try:
        # Cancel the subscription by deleting it
        deletedSubscription = stripe.Subscription.delete(data['subscriptionId'])
        return jsonify(subscription=deletedSubscription)
    except Exception as e:
        return jsonify(error=str(e)), 403


@app.route('/subscriptions', methods=['GET'])
def list_subscriptions():
    # Simulating authenticated user. Lookup the logged in user in your
    # database, and set customer_id to the Stripe Customer ID of that user.
    customer_id = request.cookies.get('customer')

    try:
        # Retrieve all subscriptions for given customer
        subscriptions = stripe.Subscription.list(
            customer=customer_id,
            status='all',
            expand=['data.default_payment_method']
        )
        return jsonify(subscriptions=subscriptions)
    except Exception as e:
        return jsonify(error=str(e)), 403


@app.route('/invoice-preview', methods=['GET'])
def preview_invoice():
    # Simulating authenticated user. Lookup the logged in user in your
    # database, and set customer_id to the Stripe Customer ID of that user.
    customer_id = request.cookies.get('customer')

    subscription_id = request.args.get('subscriptionId')
    new_price_lookup_key = request.args.get('newPriceLookupKey')

    try:
        # Retrieve the subscription
        subscription = stripe.Subscription.retrieve(subscription_id)

        # Retrive the Invoice
        invoice = stripe.Invoice.upcoming(
            customer=customer_id,
            subscription=subscription_id,
            subscription_items=[{
                'id': subscription['items']['data'][0].id,
                'price': os.getenv(new_price_lookup_key),
            }],
        )
        return jsonify(invoice=invoice)
    except Exception as e:
        return jsonify(error=str(e)), 403


@app.route('/update-subscription', methods=['POST'])
def update_subscription():
    data = json.loads(request.data)
    try:
        subscription = stripe.Subscription.retrieve(data['subscriptionId'])

        update_subscription = stripe.Subscription.modify(
            data['subscriptionId'],
            items=[{
                'id': subscription['items']['data'][0].id,
                'price': os.getenv(data['newPriceLookupKey'].upper()),
            }]
        )
        return jsonify(update_subscription)
    except Exception as e:
        return jsonify(error=str(e)), 403


@app.route('/webhook', methods=['POST'])
def webhook_received():
    # You can use webhooks to receive information about asynchronous payment events.
    # For more about our webhook events check out https://stripe.com/docs/webhooks.
    webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
    request_data = json.loads(request.data)

    if webhook_secret:
        # Retrieve the event by verifying the signature using the raw body and secret if webhook signing is configured.
        signature = request.headers.get('stripe-signature')
        try:
            event = stripe.Webhook.construct_event(
                payload=request.data, sig_header=signature, secret=webhook_secret)
            data = event['data']
        except Exception as e:
            return e
        event_type = event['type']
    else:
        data = request_data['data']
        event_type = request_data['type']

    data_object = data['object']

    if event_type == 'invoice.payment_succeeded':
        if data_object['billing_reason'] == 'subscription_create':
            # The subscription automatically activates after successful payment
            # Set the payment method used to pay the first invoice
            # as the default payment method for that subscription
            subscription_id = data_object['subscription']
            payment_intent_id = data_object['payment_intent']

            # Retrieve the payment intent used to pay the subscription
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)

            # Set the default payment method
            stripe.Subscription.modify(
              subscription_id,
              default_payment_method=payment_intent.payment_method
            )

            print("Default payment method set for subscription:" + payment_intent.payment_method)
    elif event_type == 'invoice.payment_failed':
        # If the payment fails or the customer does not have a valid payment method,
        # an invoice.payment_failed event is sent, the subscription becomes past_due.
        # Use this webhook to notify your user that their payment has
        # failed and to retrieve new card details.
        # print(data)
        print('Invoice payment failed: %s', event.id)

    elif event_type == 'invoice.finalized':
        # If you want to manually send out invoices to your customers
        # or store them locally to reference to avoid hitting Stripe rate limits.
        # print(data)
        print('Invoice finalized: %s', event.id)

    elif event_type == 'customer.subscription.deleted':
        # handle subscription cancelled automatically based
        # upon your subscription settings. Or if the user cancels it.
        # print(data)
        print('Subscription canceled: %s', event.id)

    return jsonify({'status': 'success'})


if __name__ == '__main__':
    app.run(port=4242, debug=True)
