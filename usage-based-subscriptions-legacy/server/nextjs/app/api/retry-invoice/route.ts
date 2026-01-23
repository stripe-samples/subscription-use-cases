import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const { customerId, paymentMethodId, invoiceId } = await request.json();

    // Set the default payment method on the customer
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    } catch (error) {
      // in case card_decline error
      const message = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json(
        { result: { error: { message } } },
        { status: 402 }
      );
    }

    const invoice = await stripe.invoices.retrieve(invoiceId, {
      expand: ["payment_intent"],
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error retrying invoice:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
