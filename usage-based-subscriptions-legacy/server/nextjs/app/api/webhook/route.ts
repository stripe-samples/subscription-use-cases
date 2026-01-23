import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    if (process.env.STRIPE_WEBHOOK_SECRET && signature) {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // Handle the event
  // Review important events for Billing webhooks
  // https://stripe.com/docs/billing/webhooks
  switch (event.type) {
    case "invoice.paid":
      // Used to provision services after the trial has ended.
      // The status of the invoice will show up as paid. Store the status in your
      // database to reference when a user accesses your service to avoid hitting rate limits.
      console.log("Invoice paid:", (event.data.object as Stripe.Invoice).id);
      break;
    case "invoice.payment_failed":
      // If the payment fails or the customer does not have a valid payment method,
      // an invoice.payment_failed event is sent, the subscription becomes past_due.
      // Use this webhook to notify your user that their payment has
      // failed and to retrieve new card details.
      console.log(
        "Invoice payment failed:",
        (event.data.object as Stripe.Invoice).id
      );
      break;
    case "invoice.finalized":
      // If you want to manually send out invoices to your customers
      // or store them locally to reference to avoid hitting Stripe rate limits.
      console.log(
        "Invoice finalized:",
        (event.data.object as Stripe.Invoice).id
      );
      break;
    case "customer.subscription.deleted":
      const subscription = event.data.object as Stripe.Subscription;
      if (event.request != null) {
        // handle a subscription cancelled by your request
        // from above.
        console.log("Subscription cancelled by request:", subscription.id);
      } else {
        // handle subscription cancelled automatically based
        // upon your subscription settings.
        console.log("Subscription cancelled automatically:", subscription.id);
      }
      break;
    case "customer.subscription.trial_will_end":
      // Send notification to your user that the trial will end
      console.log(
        "Subscription trial will end:",
        (event.data.object as Stripe.Subscription).id
      );
      break;
    default:
      // Unexpected event type
      console.log("Unhandled event type:", event.type);
  }

  return NextResponse.json({ received: true });
}
