import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const { customerId, paymentMethodId, priceId } = await request.json();

    // Set the default payment method on the customer
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json({ error: { message } }, { status: 402 });
    }

    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Get the price ID from environment variables
    const actualPriceId = process.env[priceId];
    if (!actualPriceId) {
      return NextResponse.json(
        { error: { message: `Price ID not found for ${priceId}` } },
        { status: 400 }
      );
    }

    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: actualPriceId }],
      expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
    });

    return NextResponse.json(subscription);
  } catch (error) {
    console.error("Error creating subscription:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
