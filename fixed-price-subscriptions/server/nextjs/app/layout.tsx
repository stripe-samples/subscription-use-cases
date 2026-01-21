import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fixed-Price Subscriptions",
  description: "Stripe subscription sample with fixed-price plans",
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
