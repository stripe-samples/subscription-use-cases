import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const customerId = cookieStore.get("customer")?.value;

    if (!customerId) {
      return NextResponse.json(
        { error: { message: "Customer not found" } },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const subscriptionId = searchParams.get("subscriptionId");
    const newPriceLookupKey = searchParams.get("newPriceLookupKey");

    if (!subscriptionId || !newPriceLookupKey) {
      return NextResponse.json(
        { error: { message: "Missing required parameters" } },
        { status: 400 }
      );
    }

    const priceId = process.env[newPriceLookupKey.toUpperCase()];

    if (!priceId) {
      return NextResponse.json(
        { error: { message: "Price not found for lookup key" } },
        { status: 400 }
      );
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const invoice = await stripe.invoices.createPreview({
      customer: customerId,
      subscription: subscriptionId,
      subscription_details: {
        items: [
          {
            id: subscription.items.data[0].id,
            price: priceId,
          },
        ],
      },
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: { message: err.message } }, { status: 400 });
  }
}
