import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;

  // If STRIPE_WEBHOOK_SECRET is set, verify the signature
  if (process.env.STRIPE_WEBHOOK_SECRET && signature) {
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.log(`Webhook signature verification failed: ${message}`);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }
  } else {
    // Otherwise use the basic event deserialized with JSON.parse
    event = JSON.parse(body) as Stripe.Event;
  }

  // Print out the event to the console
  console.log(`Received webhook event ${event.type} ${event.id}`);

  return NextResponse.json({ received: true }, { status: 200 });
}
