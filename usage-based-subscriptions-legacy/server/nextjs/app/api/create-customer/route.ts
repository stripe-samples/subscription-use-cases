import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Create a new customer object
    const customer = await stripe.customers.create({
      email,
    });

    // In a real application, you would save the customer.id as stripeCustomerId
    // in your database.

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("Error creating customer:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
