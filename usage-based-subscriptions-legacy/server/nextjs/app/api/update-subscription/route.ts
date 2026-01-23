import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const { subscriptionId, newPriceId } = await request.json();

    // Get the actual price ID from environment variables
    const actualPriceId = process.env[newPriceId];
    if (!actualPriceId) {
      return NextResponse.json(
        { error: { message: `Price ID not found for ${newPriceId}` } },
        { status: 400 }
      );
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
      items: [
        {
          id: subscription.items.data[0].id,
          price: actualPriceId,
        },
      ],
    });

    return NextResponse.json(updatedSubscription);
  } catch (error) {
    console.error("Error updating subscription:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
