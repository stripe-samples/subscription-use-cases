# Subscriptions with fixed price

An [Express server](http://expressjs.com) implementation.

## Requirements

- Node v10+
- [Configured .env file](../README.md)

## How to run

1. Install dependencies

```
npm install
```

2. Run the application

```
npm start
```

3. Go to `localhost:4242` to see the demo

### Run with docker-compose.yml

```
docker-compose run --rm stripe login
docker-compose run --rm stripe # Copy the webhook signing secret that start with "whsec_..." and set it as STRIPE_WEBHOOK_SECRET in the .env file

docker-compose run --rm web npm install
docker-compose up
```
