import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const { displayName, eventName, aggregationFormula } = await request.json();

    const meter = await stripe.billing.meters.create({
      display_name: displayName,
      event_name: eventName,
      default_aggregation: {
        formula: aggregationFormula,
      },
    });

    return NextResponse.json({ meter });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 400 });
  }
}
