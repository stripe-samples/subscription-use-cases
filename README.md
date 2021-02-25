# Set up subscriptions with Stripe Billing

This sample shows how to create a customer and subscribe them to a plan with
[Stripe Billing](https://stripe.com/billing). For the official documentation
for Stripe billing checkout the [overview](https://stripe.com/docs/billing).

|                                                                                                                             |        [Checkout](https://github.com/stripe-samples/checkout-single-subscription)        |                                                          [Fixed-price-subscriptions with Elements](./fixed-price-subscriptions)                                                          |                                                                           [Usage-based-subscriptions with Elements](./usage-based-subscriptions)                                                                           |                                                          [Per-seat-subscriptions with Elements](./per-seat-subscriptions)                                                          |
| :-------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| **Demo**                                                                                                                    | See a hosted version of the sample at [checkout.stripe.dev](https://checkout.stripe.dev) | See a hosted version of the [sample](https://xt7b9.sse.codesandbox.io/) in test mode or [fork on codesandbox.io](https://codesandbox.io/s/github/stripe-samples/subscription-use-cases/tree/master/fixed-price-subscriptions) | See a hosted version of the [sample](https://l2sny.sse.codesandbox.io/) in test mode or [fork on codesandbox.io](https://codesandbox.io/s/stripe-sample-usage-based-subscriptions-l2sny) | See a hosted version of the [sample](https://v211e.sse.codesandbox.io/) in test mode or [fork on codesandbox.io](https://codesandbox.io/s/github/stripe-samples/subscription-use-cases/tree/master/per-seat-subscriptions) |
| **Define prices in: CLI, Dashboard, or API** Create a price with the Stripe: CLI, Dashboard, or API.                        |                                            ✅                                            |                                                                                            ✅                                                                                            |                                                                                                             ✅                                                                                                             |                                                                                         ✅                                                                                         |
| **Charge users a fixed price on a recurring basis** Create a subscription with a fixed price recurring monthly/yearly/etc.  |                                            ✅                                            |                                                                                            ✅                                                                                            |                                                                                                                                                                                                                            |                                                                                                                                                                                    |
| **Charge users per seat on a recurring basis.** Create a subscription that charges based on the amount of seats used.       |                                            ✅                                            |                                                                                                                                                                                          |                                                                                                                                                                                                                            |                                                                                         ✅                                                                                         |
| **Charge customers based on their usage.** Create a metered subscriptions so you can charge customers based on their usage. |                                            ✅                                            |                                                                                                                                                                                          |                                                                                                             ✅                                                                                                             |                                                                                                                                                                                    |
| **Apple Pay & Google Pay support**                                                                                          |                            ✅ Built in, no extra code needed                             |                                                                                                                                                                                          |                                                                                                                                                                                                                            |                                                                                                                                                                                    |
| **Coupon support for subscriptions**                                                                                        |                                            ✅                                            |                                                                                            ✅                                                                                            |                                                                                                             ✅                                                                                                             |                                                                                         ✅                                                                                         |

The hosted demos linked above are running in test mode -- use
`4242424242424242` as a test card number with any CVC + future expiration date.

Use the `4000002500003155` test card number to trigger a 3D Secure challenge
flow.

Read more about test cards on Stripe at https://stripe.com/docs/testing.

## Run the sample locally

_This sample can be installed two ways -- Stripe CLI or git clone. The `.env`
configuration will vary depending on which way you install._

### Requirements

- **A Stripe account**: You can sign up for a Stripe account here: https://dashboard.stripe.com/register
- **Stripe API Keys**: Available in your Stripe dashboard here: https://dashboard.stripe.com/test/apikeys
- **2 Prices**: This sample demonstrates two tiers of pricing. You'll need the IDs for two Price objects from your Stripe account. See [How to create Prices](#how-to-create-prices) below for more information.

### Installing the sample

The Stripe CLI is the fastest way to clone and configure a sample to run
locally and is the recommended approach as it will only download the code
required for the server language you select. Alternatively, you can download
and run directly with this repository.

#### Option 1: Installing with Stripe CLI

1. If you haven't already installed the CLI, follow the [installation
   steps](https://stripe.com/docs/stripe-cli#install). The CLI is useful for
   cloning samples and locally testing webhooks and Stripe integrations.

2. Ensure the CLI is linked to your Stripe account by running:

```sh
stripe login
```

3. Start the sample installer and follow the prompts with:

```sh
stripe samples create subscription-use-cases
```

The CLI will walk you through picking your integration type, server and client
languages, and partially configuring your `.env` file with your Stripe API keys.

4. Move into the server directory:

```sh
cd subscription-use-cases/server
```

5. Open `server/.env` and set the ID values for `BASIC` and `PREMIUM` to the
   IDs of two Prices from your Stripe account. The API keys should
   already have been configured by the Stripe CLI. The `STATIC_DIR` value
   should be `../client` when installed using the Stripe CLI.

```yml
# Billing variables
BASIC=price_12345...
PREMIUM=price_7890...


# Stripe keys
STRIPE_PUBLISHABLE_KEY=pk_12345
STRIPE_SECRET_KEY=sk_12345
STRIPE_WEBHOOK_SECRET=whsec_1234

# Stripe key for React front end
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_12345

# Environment variables
STATIC_DIR=../client
```

6. Follow the instructions in `server/README.md` for how to build and/or run the server.

7. View in the browser: [localhost:4242](http://localhost:4242) and test with `4242424242424242`.

8. [Optional] Forward webhook events

You can use the Stripe CLI to forward webhook events to your server running
locally.

```
stripe listen --forward-to localhost:4242/webhook
```

You should see events logged in the console where the CLI is running.

When you are ready to create a live webhook endpoint, follow our guide in the
docs on [configuring a webhook endpoint in the
dashboard](https://stripe.com/docs/webhooks/setup#configure-webhook-settings).

#### Option 2: Installing manually

If you do not want to use the Stripe CLI, you can manually clone and configure the sample:

1. Clone the repository

```sh
git clone git@github.com:stripe-samples/subscription-use-cases.git
cd subscription-use-cases
```

2. Configure `.env`

The `.env` file contains the API keys and some settings to enable the sample to
run with data for your Stripe account.

Copy the `.env.example` file from the root of the project into a file named
`.env` in the folder of the server language you want to use. For example with node:

```sh
cp .env.example fixed-price-subscriptions/server/node/.env
cd fixed-price-subscriptions/server/node
```

For example with ruby:

```sh
cp .env.example fixed-price-subscriptions/server/ruby/.env
cd fixed-price-subscriptions/server/ruby
```

3. Edit the copied `.env` and populate all of the variables. For more information see: [`.env` config](#env-config)

```yml
# Stripe keys
STRIPE_PUBLISHABLE_KEY=pk_12345
STRIPE_SECRET_KEY=sk_12345
STRIPE_WEBHOOK_SECRET=whsec_1234

# Stripe key for React front end
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_12345

# Billing variables
BASIC=price_12345...
PREMIUM=price_7890...

# Environment variables
STATIC_DIR=../../client/vanillajs
```

4. Follow the server instructions on how to run:

Pick the server language you want and follow the instructions in the server folder README on how to run.

```
cd fixed-price-subscriptions/server/node # there's a README in this folder with instructions
npm install
npm start
```

5. [Optional] Forward webhook events

You can use the Stripe CLI to forward webhook events to your server running
locally.

If you haven't already, [install the CLI](https://stripe.com/docs/stripe-cli)
and [link your Stripe
account](https://stripe.com/docs/stripe-cli#link-account).

```
stripe listen --forward-to localhost:4242/webhook
```

You should see events logged in the console where the CLI is running.

When you are ready to create a live webhook endpoint, follow our guide in the
docs on [configuring a webhook endpoint in the
dashboard](https://stripe.com/docs/webhooks/setup#configure-webhook-settings).

## How to create Prices

### With the Stripe CLI

Run the following commands and copy the resulting IDs.

```sh
stripe prices create --unit-amount 500 --currency usd -d "recurring[interval]=month" -d "product_data[name]=basic"
```

```sh
stripe prices create --unit-amount 900 --currency usd -d "recurring[interval]=month" -d "product_data[name]=premium"
```

### Or from the Dashbaord

1. From the Stripe dashboard go to **Products** > [Add product](https://dashboard.stripe.com/test/products/create)
2. Fill in the product name `Basic` and the value ($5/month) for the price and save
3. Repeat and create a **SECOND** product and price, this time with `Premium` and ($12/month)

## `.env` config

Example configuration file [`.env.example`](./.env.example)

- **STRIPE_PUBLISHABLE_KEY**: Found in the dashboard here: https://dashboard.stripe.com/test/apikeys
- **STRIPE_SECRET_KEY**: Found in the dashboard here: https://dashboard.stripe.com/test/apikeys
- **STRIPE_WEBHOOK_SECRET**: If using the Stripe CLI (recommended) run `stripe listen --print-secret`, otherwise you can find the signing secret for the webhook endpoint in the dashboard by viewing the details of the endpoint here: https://dashboard.stripe.com/test/webhooks.
- **STATIC_DIR**: The path to the directory containing the client side code. For vanillajs on the client, this will be `../../client/vanillajs`.
- **BASIC**: The ID of the basic Price. You can find this in the Stripe dashbaord by viewing the basic product created earlier.
- **PREMIUM**: The ID of the premium Price. You can find this in the Stripe dashbaord by viewing the premium product created earlier.

## FAQ

Q: Why did you pick these frameworks?

A: We chose the most minimal framework to convey the key Stripe calls and
concepts you need to understand. These demos are meant as an educational tool
that helps you roadmap how to integrate Stripe within your own system
independent of the framework.

## Get support
If you found a bug or want to suggest a new [feature/use case/sample], please [file an issue](../../issues).

If you have questions, comments, or need help with code, we're here to help:
- on [IRC via freenode](https://webchat.freenode.net/?channel=#stripe)
- on Twitter at [@StripeDev](https://twitter.com/StripeDev)
- on Stack Overflow at the [stripe-payments](https://stackoverflow.com/tags/stripe-payments/info) tag
- by [email](mailto:support+github@stripe.com)

Sign up to [stay updated with developer news](https://go.stripe.global/dev-digest).

## Author(s)

- [@ctrudeau-stripe](https://twitter.com/trudeaucj)
- [@suz-stripe](https://twitter.com/noopkat)
- [@dawn-stripe](https://twitter.com/dawnlambeth)
- [@cjavilla-stripe](https://twitter.com/cjav_dev)
