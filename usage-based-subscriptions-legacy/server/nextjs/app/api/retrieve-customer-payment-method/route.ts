import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const { paymentMethodId } = await request.json();

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    return NextResponse.json(paymentMethod);
  } catch (error) {
    console.error("Error retrieving payment method:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
