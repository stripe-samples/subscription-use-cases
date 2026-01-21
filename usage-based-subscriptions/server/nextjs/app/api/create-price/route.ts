import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const { meterId, currency, amount, productName } = await request.json();

    const price = await stripe.prices.create({
      currency,
      unit_amount: amount,
      recurring: {
        interval: "month",
        meter: meterId,
        usage_type: "metered",
      },
      product_data: {
        name: productName,
      },
    });

    return NextResponse.json({ price });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 400 });
  }
}
