import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Usage-Based Subscriptions (Legacy)",
  description: "Learn how to create usage-based subscriptions with Stripe",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css?family=Raleway&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
