# Subscriptions with metered usage

## Requirements

- PHP >= 7.1.3
- Composer
- [Slim](http://www.slimframework.com/)

## How to run

1. Install dependencies

```
composer install
```

2. Run the application

```
composer start
```

3. Go to `localhost:4242` in your browser to see the demo

### Run with docker-compose.yml

```
docker-compose run --rm stripe login
docker-compose run --rm stripe # Copy the webhook signing secret that start with "whsec_..." and set it as STRIPE_WEBHOOK_SECRET in the .env file

docker-compose run --rm web install
docker-compose up
```
