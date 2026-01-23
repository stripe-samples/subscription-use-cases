import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const { subscriptionId, customerId, newPriceId } = await request.json();

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Get the actual price ID from environment variables
    const actualPriceId = process.env[newPriceId];
    if (!actualPriceId) {
      return NextResponse.json(
        { error: { message: `Price ID not found for ${newPriceId}` } },
        { status: 400 }
      );
    }

    const invoice = await stripe.invoices.retrieveUpcoming({
      customer: customerId,
      subscription: subscriptionId,
      subscription_items: [
        {
          id: subscription.items.data[0].id,
          clear_usage: true,
          deleted: true,
        },
        {
          price: actualPriceId,
          deleted: false,
        },
      ],
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error retrieving upcoming invoice:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
