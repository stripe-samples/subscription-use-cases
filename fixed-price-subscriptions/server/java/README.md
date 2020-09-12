# Subscriptions with fixed price

## Requirements

- Maven
- Java
- [Configured .env file](../README.md)

1. Build the package

```
mvn package
```

2. Run the application

```
java -cp target/subscriptions-with-fixed-price-1.0.0-SNAPSHOT-jar-with-dependencies.jar com.stripe.sample.Server
```

3. Go to `localhost:4242` in your browser to see the demo

### Run with docker-compose.yml

```
docker-compose run --rm stripe login
docker-compose run --rm stripe # Copy the webhook signing secret that start with "whsec_..." and set it as STRIPE_WEBHOOK_SECRET in the .env file

docker-compose run --rm web mvn package
docker-compose up
```
