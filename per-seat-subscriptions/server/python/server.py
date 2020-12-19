#! /usr/bin/env python3.6

"""
server.py
Stripe Recipe.
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

static_dir = str(os.path.abspath(os.path.join(
    __file__, "..", os.getenv("STATIC_DIR"))))
app = Flask(__name__, static_folder=static_dir,
            static_url_path="", template_folder=static_dir)


@app.route('/', methods=['GET'])
def get_index():
    return render_template('index.html')


@app.route('/config', methods=['GET'])
def get_config():
    return jsonify(
        publishableKey=os.getenv('STRIPE_PUBLISHABLE_KEY'),
    )


@app.route('/retrieve-subscription-information', methods=['POST'])
def retrieve_subscription_information():
    data = json.loads(request.data)
    subscriptionId = data['subscriptionId']

    try:
        subscription = stripe.Subscription.retrieve(
            subscriptionId,
            expand=['latest_invoice',
                    'customer.invoice_settings.default_payment_method',
                    'items.data.price.product']
        )

        upcoming_invoice = stripe.Invoice.upcoming(subscription=subscriptionId)

        item = subscription['items']['data'][0]
        return jsonify(
            card=subscription.customer.invoice_settings.default_payment_method.card,
            product_description=item.price.product.name,
            current_price=item.price.id,
            current_quantity=item.quantity,
            latest_invoice=subscription.latest_invoice,
            upcoming_invoice=upcoming_invoice
        )
    except Exception as e:
        return jsonify(error=str(e)), 403


@app.route('/create-customer', methods=['POST'])
def create_customer():
    # Reads application/json and returns a response
    data = json.loads(request.data)
    try:
        # Create a new customer object
        customer = stripe.Customer.create(
            email=data['email']
        )
        # At this point, associate the ID of the Customer object with your
        # own internal representation of a customer, if you have one.

        return jsonify(
            customer=customer,
        )
    except Exception as e:
        return jsonify(error=str(e)), 403


@app.route('/create-subscription', methods=['POST'])
def createSubscription():
    data = json.loads(request.data)
    try:

        payment_method = stripe.PaymentMethod.attach(
            data['paymentMethodId'],
            customer=data['customerId'],
        )
        # Set the default payment method on the customer
        stripe.Customer.modify(
            data['customerId'],
            invoice_settings={
                'default_payment_method': payment_method.id,
            },
        )

        # Create the subscription
        subscription = stripe.Subscription.create(
            customer=data['customerId'],
            items=[
                {
                    'price': os.getenv(data['priceId'].upper()),
                    'quantity': data['quantity']
                }
            ],
            expand=['latest_invoice.payment_intent', 'plan.product'],
        )
        return jsonify(subscription)
    except Exception as e:
        return jsonify(error={'message': str(e)}), 400


@app.route('/retry-invoice', methods=['POST'])
def retrySubscription():
    data = json.loads(request.data)
    try:

        payment_method = stripe.PaymentMethod.attach(
            data['paymentMethodId'],
            customer=data['customerId'],
        )
        # Set the default payment method on the customer
        stripe.Customer.modify(
            data['customerId'],
            invoice_settings={
                'default_payment_method': payment_method.id,
            },
        )

        invoice = stripe.Invoice.retrieve(
            data['invoiceId'],
            expand=['payment_intent'],
        )
        return jsonify(invoice)
    except Exception as e:
        return jsonify(error={'message': str(e)}), 200


@app.route('/retrieve-upcoming-invoice', methods=['POST'])
def retrieveUpcomingInvoice():
    data = json.loads(request.data)
    try:
        new_price = os.getenv(data['newPriceId'].upper())
        quantity = data['quantity']
        subscriptionId = data.get('subscriptionId', None)

        params = dict(
            customer=data['customerId']
        )

        if subscriptionId != None:
            # Retrieve the subscription
            subscription = stripe.Subscription.retrieve(subscriptionId)
            params["subscription"] = subscriptionId
            current_price = subscription['items']['data'][0].price.id

            if current_price == new_price:
                params["subscription_items"] = [
                    {
                        "id": subscription['items']['data'][0].id,
                        "quantity":quantity
                    }]

            else:
                params["subscription_items"] = [
                    {
                        "id": subscription['items']['data'][0].id,
                        "deleted": True
                    },
                    {
                        "price": new_price,
                        "quantity": quantity
                    }
                ]

        else:
            params["subscription_items"] = [
                {
                    "price": new_price,
                    "quantity": quantity
                }
            ]

        # Retrive the Invoice
        invoice = stripe.Invoice.upcoming(**params)
        response = {}

        if subscriptionId != None:
            current_period_end = subscription.current_period_end
            immediate_total = 0
            next_invoice_sum = 0

            for invoiceLineItem in invoice.lines.data:
                if invoiceLineItem.period.end == current_period_end:
                    immediate_total += invoiceLineItem.amount
                else:
                    next_invoice_sum += invoiceLineItem.amount

            response = {
                'immediate_total': immediate_total,
                'next_invoice_sum': next_invoice_sum,
                'invoice': invoice
            }
        else:
            response = {
                'invoice': invoice
            }

        return jsonify(response)
    except Exception as e:
        return jsonify(error=str(e)), 403


@app.route('/cancel-subscription', methods=['POST'])
def cancelSubscription():
    data = json.loads(request.data)
    try:
         # Cancel the subscription by deleting it
        deletedSubscription = stripe.Subscription.delete(
            data['subscriptionId'])
        return jsonify(deletedSubscription)
    except Exception as e:
        return jsonify(error=str(e)), 403


@app.route('/update-subscription', methods=['POST'])
def updateSubscription():
    data = json.loads(request.data)
    try:
        new_price = os.getenv(data['newPriceId'].upper())
        quantity = data['quantity']
        subscriptionId = data.get('subscriptionId', None)
        subscription = stripe.Subscription.retrieve(subscriptionId)
        current_price = subscription['items']['data'][0].price.id

        if current_price == new_price:
            updatedSubscription = stripe.Subscription.modify(
                subscriptionId,
                items=[{
                    'id': subscription['items']['data'][0].id,
                    'quantity': quantity,
                }],
                expand=['plan.product']
            )

        else:
            updatedSubscription = stripe.Subscription.modify(
                subscriptionId,
                items=[{
                    'id': subscription['items']['data'][0].id,
                    'deleted': True,
                },
                    {
                    'price': new_price,
                    'quantity': quantity
                }],
                expand=['plan.product']
            )

        invoice = stripe.Invoice.create(
            customer=subscription.customer,
            subscription=subscriptionId,
            description="Change to " + str(quantity) +
            " seat(s) on the " + updatedSubscription.plan.product.name + " plan"
        )

        invoice = stripe.Invoice.pay(invoice.id)

        return jsonify({'subscription': updatedSubscription})
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
        # Get the type of webhook event sent - used to check the status of PaymentIntents.
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
