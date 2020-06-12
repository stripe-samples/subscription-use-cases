#! /usr/bin/env python3.6

"""
report_usage.py
Stripe Recipe.
This code can be run on interval for each active metered subscription.
An example of an interval could be reporting usage once every 24 hours, or even once a minute.
Python 3.6 or newer required.
"""

import os
import time
import uuid
import stripe
from dotenv import load_dotenv, find_dotenv

# Setup Stripe python client library
load_dotenv(find_dotenv())
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
#stripe.api_version = os.getenv('STRIPE_API_VERSION')

def report_usage():
    # Important: your own business logic is needed here before the next step.
    # Here is where to pull a record of a customer from your own database.
    # Extract the customer's Stripe Subscription Item ID and usage for today from your database record in preparation for reporting to Stripe.
    subscription_item_id = ''
    # The usage number you've been keeping track of in your own database for the last 24 hours (or the interval you have set for your needs)
    usage_quantity = 100

    timestamp = int(time.time())
    # The idempotency key allows you to retry this usage record call if it fails (for example, a network timeout)
    idempotency_key = str(uuid.uuid4())

    try:
         stripe.SubscriptionItem.create_usage_record(
            subscription_item_id,
            quantity=usage_quantity,
            timestamp=timestamp,
            action='increment',
            idempotency_key=idempotency_key
        )
    except stripe.error.StripeError as e:
        print('usage report failed for item ID %s with idempotency key %s: %s' % (subscription_item_id, idempotency_key, e))

if __name__ == '__main__':
    report_usage()
