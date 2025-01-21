#! /usr/bin/env python3.6

"""
server.py
Stripe Recipe.
Python 3.6 or newer required.
"""

from stripe import StripeError, StripeClient
import json
import os

from flask import Flask, render_template, jsonify, request
from dotenv import load_dotenv, find_dotenv

# Setup Stripe python client library
load_dotenv(find_dotenv())

stripe_secret_key = os.getenv('STRIPE_SECRET_KEY')
if stripe_secret_key is None:
    raise ValueError("STRIPE_SECRET_KEY environment variable is not set")
client = StripeClient(api_key=stripe_secret_key, stripe_version='2024-09-30.acacia')

app = Flask(__name__, static_url_path="")


@app.route('/', methods=['GET'])
def get_index():
    return render_template('index.html')


@app.route('/config', methods=['GET'])
def get_config():
    return jsonify(
        publishableKey=os.getenv('STRIPE_PUBLISHABLE_KEY'),
    )


@app.route('/create-customer', methods=['POST'])
def create_customer():
    # Reads application/json and returns a response
    data = json.loads(request.data)
    try:
        # Create a new customer object
        customer = client.customers.create(
            params={
                'email': data['email'],
                'name': data['name'],
            }
        )
        # At this point, associate the ID of the Customer object with your
        # own internal representation of a customer, if you have one.
        return jsonify(
            customer=customer,
        )
    except StripeError as e:
        return jsonify(error={'message':e._message}), 403

@app.route('/create-meter', methods=['POST'])
def create_meter():
    # Reads application/json and returns a response
    data = json.loads(request.data)
    try:
        meter = client.billing.meters.create(
            params={
                'display_name': data['displayName'],
                'event_name': data['eventName'],
                'default_aggregation': {
                    'formula': data['aggregationFormula'],
                },
            }
        )
        return jsonify(
            meter=meter,
        )
    except StripeError as e:
        return jsonify(error={'message':e._message}), 403

@app.route('/create-price', methods=['POST'])
def create_price():
    # Reads application/json and returns a response
    data = json.loads(request.data)
    try:
        # Create a new price object
        price = client.prices.create(
            params={
                'currency': data['currency'],
                'unit_amount': data['amount'],
                'recurring': {
                    'interval': 'month',
                    'usage_type': 'metered',
                    'meter': data['meterId']
                },
                'product_data': {
                    'name': data['productName']
                }
            }
        )
        return jsonify(
            price=price,
        )
    except StripeError as e:
        return jsonify(error={'message':e._message}), 403

@app.route('/create-subscription', methods=['POST'])
def createSubscription():
    data = json.loads(request.data)
    try:

        # Create the subscription
        subscription = client.subscriptions.create(
            params={
                'customer': data['customerId'],
                'items': [
                    {
                        'price': data['priceId']
                    }
                ],
                'expand': ['pending_setup_intent'],
            }
        )
        return jsonify(
            subscription=subscription,
        )
    except Exception as e:
        return jsonify(error={'message': str(e)}), 200

@app.route('/create-meter-event', methods=['POST'])
def create_meter_event():
    # Reads application/json and returns a response
    data = json.loads(request.data)
    try:
        meterEvent = client.v2.billing.meter_events.create(
            params={
                'event_name': data['eventName'],
                'payload': {
                    'value': str(data['value']),
                    'stripe_customer_id': data['customerId'],
                }
            }
        )
        return jsonify(
            meterEvent=meterEvent,
        )
    except StripeError as e:
        return jsonify(error={'message':e._message}), 403

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
            return jsonify(error={'message': str(e)}), 400
        # Get the type of webhook event sent - used to check the status of PaymentIntents.
        event_type = event['type']
    else:
        data = request_data['data']
        event_type = request_data['type']

    if event_type == 'invoice.paid':
        # Used to provision services after the trial has ended.
        # The status of the invoice will show up as paid. Store the status in your
        # database to reference when a user accesses your service to avoid hitting rate
        # limits.
        print(data)

    if event_type == 'invoice.payment_failed':
        # If the payment fails or the customer does not have a valid payment method,
        # an invoice.payment_failed event is sent, the subscription becomes past_due.
        # Use this webhook to notify your user that their payment has
        # failed and to retrieve new card details.
        print(data)

    if event_type == 'invoice.finalized':
        # If you want to manually send out invoices to your customers
        # or store them locally to reference to avoid hitting Stripe rate limits.
        print(data)

    if event_type == 'customer.subscription.deleted':
        # handle subscription cancelled automatically based
        # upon your subscription settings. Or if the user cancels it.
        print(data)

    if event_type == 'customer.subscription.trial_will_end':
        # Send notification to your user that the trial will end
        print(data)

    return jsonify({'status': 'success'})


if __name__ == '__main__':
    app.run(port=4242)
