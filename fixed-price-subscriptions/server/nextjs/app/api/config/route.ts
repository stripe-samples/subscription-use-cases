import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function GET() {
  const prices = await stripe.prices.list({
    lookup_keys: ["sample_basic", "sample_premium"],
    expand: ["data.product"],
  });

  return NextResponse.json({
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    prices: prices.data,
  });
}
