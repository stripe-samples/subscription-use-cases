import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    // Create a new customer object
    const customer = await stripe.customers.create({
      email,
    });

    // Save the customer.id in a cookie (simulating authentication)
    const cookieStore = await cookies();
    cookieStore.set("customer", customer.id, {
      maxAge: 900000,
      httpOnly: true,
    });

    return NextResponse.json({ customer });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: { message: err.message } }, { status: 400 });
  }
}
