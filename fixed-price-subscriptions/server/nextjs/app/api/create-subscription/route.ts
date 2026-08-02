import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    // Simulate authenticated user. In practice this will be the
    // Stripe Customer ID related to the authenticated user.
    const cookieStore = await cookies();
    const customerId = cookieStore.get("customer")?.value;

    if (!customerId) {
      return NextResponse.json(
        { error: { message: "Customer not found" } },
        { status: 400 }
      );
    }

    const { priceId } = await req.json();

    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: priceId,
        },
      ],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.confirmation_secret"],
    });

    const invoice = subscription.latest_invoice;
    if (typeof invoice !== "object" || invoice === null) {
      throw new Error("Invoice not found");
    }

    const confirmationSecret = invoice.confirmation_secret;
    if (typeof confirmationSecret !== "object" || confirmationSecret === null) {
      throw new Error("Invoice confirmation_secret not found (Basil+ API)");
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret: confirmationSecret.client_secret,
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: { message: err.message } }, { status: 400 });
  }
}
