export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-8">
          Fixed-Price Subscriptions
        </h1>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-center text-gray-600">
            This is a Next.js API server for fixed-price subscriptions.
          </p>
          <p className="text-center text-gray-600 mt-4">
            Use the client application to interact with this server.
          </p>
        </div>
      </div>
    </main>
  );
}
