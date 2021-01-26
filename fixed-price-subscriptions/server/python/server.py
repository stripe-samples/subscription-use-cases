#! /usr/bin/env python3.6
"""
Python 3.6 or newer required.
"""
import stripe
import json
import os

from flask import Flask, render_template, jsonify, request, send_from_directory
from dotenv import load_dotenv, find_dotenv

# Setup Stripe python client library
load_dotenv(find_dotenv())
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
stripe.api_version = os.getenv('STRIPE_API_VERSION')

static_dir = str(os.path.abspath(os.path.join(__file__, "..", os.getenv("STATIC_DIR"))))
app = Flask(__name__, static_folder=static_dir, static_url_path="", template_folder=static_dir)


@app.route('/', methods=['GET'])
def get_index():
    return render_template('register.html')


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

    try:
        payment_method = stripe.PaymentMethod.attach(
            data['paymentMethodId'],
            customer=customer_id,
        )

        # Create the subscription
        subscription = stripe.Subscription.create(
            default_payment_method=payment_method.id,
            customer=customer_id,
            items=[{
                'price': os.getenv(data['priceLookupKey'].upper())
            }],
            expand=['latest_invoice.payment_intent'],
        )
        return jsonify(subscription=subscription)
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
         # Cancel the subscription by deleting it
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
def updateSubscription():
    data = json.loads(request.data)
    try:
        subscription = stripe.Subscription.retrieve(data['subscriptionId'])

        updatedSubscription = stripe.Subscription.modify(
            data['subscriptionId'],
            items=[{
                'id': subscription['items']['data'][0].id,
                'price': os.getenv(data['newPriceLookupKey'].upper()),
            }]
        )
        return jsonify(updatedSubscription)
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

    if event_type == 'invoice.paid':
        # Used to provision services after the trial has ended.
        # The status of the invoice will show up as paid. Store the status in your
        # database to reference when a user accesses your service to avoid hitting rate
        # limits.
        # print(data)
        print('Invoice paid: %s', event.id)

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
        print('Invoice payment failed: %s', event.id)

    elif event_type == 'customer.subscription.deleted':
        # handle subscription cancelled automatically based
        # upon your subscription settings. Or if the user cancels it.
        # print(data)
        print('Subscription canceled: %s', event.id)

    return jsonify({'status': 'success'})


if __name__ == '__main__':
    app.run(port=4242, debug=True)
