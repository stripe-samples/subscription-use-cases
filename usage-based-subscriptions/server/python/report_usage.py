#! /usr/bin/env python3.6

"""
report_usage.py
Stripe Recipe.
This code can be run on an interval (e.g., every 24 hours) for each active
metered subscription.
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
    # You need to write some of your own business logic before creating the
    # usage record. Pull a record of a customer from your database
    # and extract the customer's Stripe Subscription Item ID and usage
    # for the day. If you aren't storing subscription item IDs,
    # you can retrieve the subscription and check for subscription items
    # https://stripe.com/docs/api/subscriptions/object#subscription_object-items.
    subscription_item_id = ''
    # The usage number you've been keeping track of in your database for
    # the last 24 hours.
    usage_quantity = 100

    timestamp = int(time.time())
    # The idempotency key allows you to retry this usage record call if it fails.
    idempotency_key = str(uuid.uuid4())

    try:
         stripe.SubscriptionItem.create_usage_record(
            subscription_item_id,
            quantity=usage_quantity,
            timestamp=timestamp,
            action='set',
            idempotency_key=idempotency_key
        )
    except stripe.error.StripeError as e:
        print('Usage report failed for item ID %s with idempotency key %s: %s' % (subscription_item_id, idempotency_key, e))

if __name__ == '__main__':
    report_usage()
