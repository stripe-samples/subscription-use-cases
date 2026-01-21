import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const { eventName, customerId, value } = await request.json();

    const meterEvent = await stripe.v2.billing.meterEvents.create({
      event_name: eventName,
      payload: {
        value: String(value),
        stripe_customer_id: customerId,
      },
    });

    return NextResponse.json({ meterEvent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 400 });
  }
}
