import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const { subscriptionId } = await req.json();

    // Cancel the subscription
    const deletedSubscription = await stripe.subscriptions.cancel(subscriptionId);

    return NextResponse.json({ subscription: deletedSubscription });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: { message: err.message } }, { status: 400 });
  }
}
