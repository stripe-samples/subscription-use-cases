# Set up subscriptions with Stripe Billing

This sample shows how to create a customer and subscribe them to a plan with
[Stripe Billing](https://stripe.com/billing). You can find step by step directions in the billing [overview](https://stripe.com/docs/billing) documentation page.

In this repository there are three integrations: [fixed-price-subscriptions](./fixed-price-subscriptions), [per-seat-subscriptions](./per-seat-subscriptions), and [usage-based-subscriptions](./usage-based-subscriptions).

<!-- prettier-ignore -->
|     | [fixed-price-subscriptions](./fixed-price-subscriptions) | [per-seat-subscriptions](./per-seat-subscriptions) | [usage-based-subscriptions](./usage-based-subscriptions) |
:--- | :---: | :---: | :---: 
**Define prices in: CLI, Dashboard, or API** Create a price with the Stripe: CLI, Dashboard, or API. | ✅  | ✅ | ✅
**Charge users a fixed price on a recurring basis** Create a subscription with a fixed price recurring monthly/yearly/etc. | ✅  |  |
**Charge users per seat on a recurring basis** Create a subscription that charges based on the amount of seats used. |   | ✅ |
**Charge customers based on their usage.** Create a metered subscriptions so you can charge customers based on their usage. |  |  | ✅ |
