# Subscriptions with per seat pricing

A [Go](https://golang.org) implementation

## Requirements

- Go
- [Configured .env file](../README.md)

## How to run

1. Run the application

```
go run server.go
```

### Run with docker-compose.yml

```
docker-compose run --rm stripe login
docker-compose run --rm stripe # Copy the webhook signing secret that start with "whsec_..." and set it as STRIPE_WEBHOOK_SECRET in the .env file

docker-compose up
```
