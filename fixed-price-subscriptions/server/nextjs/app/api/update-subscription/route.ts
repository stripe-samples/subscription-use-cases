import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const { subscriptionId, newPriceLookupKey } = await req.json();

    const priceId = process.env[newPriceLookupKey.toUpperCase()];

    if (!priceId) {
      return NextResponse.json(
        { error: { message: "Price not found for lookup key" } },
        { status: 400 }
      );
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: priceId,
        },
      ],
    });

    return NextResponse.json({ subscription: updatedSubscription });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: { message: err.message } }, { status: 400 });
  }
}
