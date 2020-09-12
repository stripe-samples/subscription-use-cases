# Subscriptions with fixed price

A [Sinatra](http://sinatrarb.com/) implementation.

## Requirements

- Ruby v2.4.5+
- [Configured .env file](../README.md)

## How to run

1. Install dependencies

```
bundle install
```

2. Run the application

```
ruby server.rb
```

3. Go to `localhost:4242` in your browser to see the demo

### Run with docker-compose.yml

```
docker-compose run --rm stripe login
docker-compose run --rm stripe # Copy the webhook signing secret that start with "whsec_..." and set it as STRIPE_WEBHOOK_SECRET in the .env file

docker-compose run --rm web bundle
docker-compose up
```
