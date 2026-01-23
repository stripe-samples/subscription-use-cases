"use client";

import { useState, useEffect, FormEvent } from "react";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/get-stripe";

interface SubscriptionData {
  subscriptionId: string;
  customerId: string;
  priceId: string;
  currentPeriodEnd: number;
  paymentMethodId?: string;
}

function SubscriptionForm({
  onSubscriptionCreated,
}: {
  onSubscriptionCreated: (data: SubscriptionData) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [email, setEmail] = useState("");
  const [priceId, setPriceId] = useState("BASIC");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      // Create customer
      const customerRes = await fetch("/api/create-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const { customer } = await customerRes.json();

      // Get payment method
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setError("Card element not found");
        setLoading(false);
        return;
      }

      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
        billing_details: { email },
      });

      if (pmError) {
        setError(pmError.message || "Payment method creation failed");
        setLoading(false);
        return;
      }

      // Create subscription
      const subscriptionRes = await fetch("/api/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          paymentMethodId: paymentMethod.id,
          priceId,
        }),
      });

      const subscription = await subscriptionRes.json();

      if (subscription.error) {
        setError(subscription.error.message);
        setLoading(false);
        return;
      }

      // Handle payment confirmation if needed
      if (subscription.latest_invoice?.payment_intent) {
        const { client_secret, status } = subscription.latest_invoice.payment_intent;

        if (status === "requires_action" || status === "requires_payment_method") {
          const { error: confirmError } = await stripe.confirmCardPayment(client_secret);
          if (confirmError) {
            setError(confirmError.message || "Payment confirmation failed");
            setLoading(false);
            return;
          }
        }
      }

      onSubscriptionCreated({
        subscriptionId: subscription.id,
        customerId: customer.id,
        priceId,
        currentPeriodEnd: subscription.current_period_end,
        paymentMethodId: paymentMethod.id,
      });
    } catch (err) {
      setError("An error occurred");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 border rounded-md bg-white"
          placeholder="email@example.com"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Select Plan</label>
        <select
          value={priceId}
          onChange={(e) => setPriceId(e.target.value)}
          className="w-full p-3 border rounded-md bg-white"
        >
          <option value="BASIC">Basic Plan</option>
          <option value="PREMIUM">Premium Plan</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Card Details</label>
        <div className="p-3 border rounded-md bg-white">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: "#32325d",
                  fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                },
              },
            }}
          />
        </div>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full bg-stripe-purple text-white py-3 rounded-md font-semibold hover:bg-opacity-90 disabled:opacity-50"
      >
        {loading ? "Processing..." : "Subscribe"}
      </button>
    </form>
  );
}

function SubscriptionManager({
  subscription,
  onUpdate,
}: {
  subscription: SubscriptionData;
  onUpdate: (data: SubscriptionData | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upcomingInvoice, setUpcomingInvoice] = useState<{
    amount_due: number;
    currency: string;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<{
    card: { brand: string; last4: string };
  } | null>(null);

  useEffect(() => {
    if (subscription.paymentMethodId) {
      fetch("/api/retrieve-customer-payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId: subscription.paymentMethodId }),
      })
        .then((res) => res.json())
        .then((data) => setPaymentMethod(data))
        .catch(console.error);
    }
  }, [subscription.paymentMethodId]);

  const handleCancel = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: subscription.subscriptionId }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error.message);
      } else {
        onUpdate(null);
      }
    } catch {
      setError("Failed to cancel subscription");
    }
    setLoading(false);
  };

  const handleUpdatePlan = async (newPriceId: string) => {
    if (newPriceId === subscription.priceId) return;

    setLoading(true);
    setError(null);

    try {
      // Preview upcoming invoice
      const previewRes = await fetch("/api/retrieve-upcoming-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: subscription.subscriptionId,
          customerId: subscription.customerId,
          newPriceId,
        }),
      });
      const preview = await previewRes.json();

      if (preview.error) {
        setError(preview.error.message);
        setLoading(false);
        return;
      }

      setUpcomingInvoice({
        amount_due: preview.amount_due,
        currency: preview.currency,
      });

      // Update subscription
      const updateRes = await fetch("/api/update-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: subscription.subscriptionId,
          newPriceId,
        }),
      });
      const updated = await updateRes.json();

      if (updated.error) {
        setError(updated.error.message);
      } else {
        onUpdate({
          ...subscription,
          priceId: newPriceId,
          currentPeriodEnd: updated.current_period_end,
        });
      }
    } catch {
      setError("Failed to update subscription");
    }
    setLoading(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 p-4 rounded-md">
        <h3 className="font-semibold text-green-800">Subscription Active</h3>
        <p className="text-sm text-green-700">
          Current plan: {subscription.priceId}
        </p>
        <p className="text-sm text-green-700">
          Renews: {formatDate(subscription.currentPeriodEnd)}
        </p>
        {paymentMethod && (
          <p className="text-sm text-green-700">
            Card: {paymentMethod.card.brand} ****{paymentMethod.card.last4}
          </p>
        )}
      </div>

      {upcomingInvoice && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
          <p className="text-sm text-blue-700">
            Upcoming invoice: {(upcomingInvoice.amount_due / 100).toFixed(2)}{" "}
            {upcomingInvoice.currency.toUpperCase()}
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">Change Plan</label>
        <select
          value={subscription.priceId}
          onChange={(e) => handleUpdatePlan(e.target.value)}
          className="w-full p-3 border rounded-md bg-white"
          disabled={loading}
        >
          <option value="BASIC">Basic Plan</option>
          <option value="PREMIUM">Premium Plan</option>
        </select>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button
        onClick={handleCancel}
        disabled={loading}
        className="w-full bg-red-500 text-white py-3 rounded-md font-semibold hover:bg-opacity-90 disabled:opacity-50"
      >
        {loading ? "Processing..." : "Cancel Subscription"}
      </button>
    </div>
  );
}

export default function Home() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-8">
          Usage-Based Subscriptions (Legacy)
        </h1>

        <div className="bg-white p-8 rounded-lg shadow-md">
          {subscription ? (
            <SubscriptionManager
              subscription={subscription}
              onUpdate={setSubscription}
            />
          ) : (
            <Elements stripe={getStripe()}>
              <SubscriptionForm onSubscriptionCreated={setSubscription} />
            </Elements>
          )}
        </div>
      </div>
    </main>
  );
}
