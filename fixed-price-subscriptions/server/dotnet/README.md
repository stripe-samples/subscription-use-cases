# Subscriptions fixed price

## Requirements
- [.NET Core()]https://dotnet.microsoft.com/download)
- [Configured .env file](../README.md)

## How to run

1. Run the application
```
dotnet run
```

2. Go to `https://localhost:4242` or `http://localhost:42424` in your browser to see the demo

### Run with docker-compose.yml

```
docker-compose run --rm stripe login
docker-compose run --rm stripe # Copy the webhook signing secret that start with "whsec_..." and set it as STRIPE_WEBHOOK_SECRET in the .env file

docker-compose up
```
