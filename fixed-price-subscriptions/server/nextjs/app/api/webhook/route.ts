import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const error = err as Error;
    console.log(`Webhook signature verification failed: ${error.message}`);
    console.log(`Check the env file and enter the correct webhook secret.`);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Extract the object from the event.
  const dataObject = event.data.object as Stripe.Invoice | Stripe.Subscription;

  // Handle the event
  // Review important events for Billing webhooks
  // https://stripe.com/docs/billing/webhooks
  switch (event.type) {
    case "invoice.payment_succeeded":
      const invoice = dataObject as Stripe.Invoice;
      if (invoice.billing_reason === "subscription_create") {
        // The subscription automatically activates after successful payment
        // Set the payment method used to pay the first invoice
        // as the default payment method for that subscription
        const subscriptionId = invoice.subscription as string;
        const paymentIntentId = invoice.payment_intent as string;

        // Retrieve the payment intent used to pay the subscription
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        try {
          await stripe.subscriptions.update(subscriptionId, {
            default_payment_method: paymentIntent.payment_method as string,
          });

          console.log(
            "Default payment method set for subscription: " +
              paymentIntent.payment_method
          );
        } catch (err) {
          console.log(err);
          console.log(
            `Failed to update the default payment method for subscription: ${subscriptionId}`
          );
        }
      }
      break;
    case "invoice.payment_failed":
      // If the payment fails or the customer does not have a valid payment method,
      // an invoice.payment_failed event is sent, the subscription becomes past_due.
      // Use this webhook to notify your user that their payment has
      // failed and to retrieve new card details.
      break;
    case "invoice.finalized":
      // If you want to manually send out invoices to your customers
      // or store them locally to reference to avoid hitting Stripe rate limits.
      break;
    case "customer.subscription.deleted":
      if (event.request != null) {
        // handle a subscription cancelled by your request
        // from above.
      } else {
        // handle subscription cancelled automatically based
        // upon your subscription settings.
      }
      break;
    case "customer.subscription.trial_will_end":
      // Send notification to your user that the trial will end
      break;
    default:
    // Unexpected event type
  }

  return NextResponse.json({ received: true });
}
