export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-stripe-dark mb-6">
          Usage-Based Subscriptions
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          This sample demonstrates how to create usage-based subscriptions with
          Stripe Billing meters.
        </p>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">API Endpoints</h2>
          <ul className="space-y-2 text-gray-700">
            <li>
              <code className="bg-gray-100 px-2 py-1 rounded">
                GET /api/config
              </code>{" "}
              - Get publishable key
            </li>
            <li>
              <code className="bg-gray-100 px-2 py-1 rounded">
                POST /api/create-customer
              </code>{" "}
              - Create a customer
            </li>
            <li>
              <code className="bg-gray-100 px-2 py-1 rounded">
                POST /api/create-meter
              </code>{" "}
              - Create a billing meter
            </li>
            <li>
              <code className="bg-gray-100 px-2 py-1 rounded">
                POST /api/create-price
              </code>{" "}
              - Create a metered price
            </li>
            <li>
              <code className="bg-gray-100 px-2 py-1 rounded">
                POST /api/create-subscription
              </code>{" "}
              - Create a subscription
            </li>
            <li>
              <code className="bg-gray-100 px-2 py-1 rounded">
                POST /api/create-meter-event
              </code>{" "}
              - Record meter usage
            </li>
            <li>
              <code className="bg-gray-100 px-2 py-1 rounded">
                POST /api/webhook
              </code>{" "}
              - Handle Stripe webhooks
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
