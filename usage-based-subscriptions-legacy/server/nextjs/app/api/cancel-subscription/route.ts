import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const { subscriptionId } = await request.json();

    // Delete the subscription
    const deletedSubscription = await stripe.subscriptions.cancel(subscriptionId);

    return NextResponse.json(deletedSubscription);
  } catch (error) {
    console.error("Error canceling subscription:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
