terraform {
  required_providers {
    stripe = {
      source  = "stripe/stripe"
      version = "0.1.0"
    }
  }
}

variable "stripe_api_key" {
  description = "Stripe API key (set via TF_VAR_stripe_api_key env var)"
  type        = string
  sensitive   = true
}

provider "stripe" {
  api_key = var.stripe_api_key
}

variable "webhook_url" {
  description = "URL for Stripe webhook endpoint (e.g., https://your-server.com/webhook)"
  type        = string
  default     = ""
}

# Products
resource "stripe_product" "basic" {
  name = "Basic"
}

resource "stripe_product" "premium" {
  name = "Premium"
}

# Prices - Monthly recurring subscriptions with lookup_keys
resource "stripe_price" "basic_monthly" {
  product     = stripe_product.basic.id
  currency    = "usd"
  unit_amount = 500
  lookup_key  = "sample_basic"

  recurring {
    interval = "month"
    interval_count = 1
    trial_period_days = 0
    usage_type = "licensed"
  }
}

resource "stripe_price" "premium_monthly" {
  product     = stripe_product.premium.id
  currency    = "usd"
  unit_amount = 900
  lookup_key  = "sample_premium"

  recurring {
    interval = "month"
    interval_count = 1
    trial_period_days = 0
    usage_type = "licensed"
  }
}

# Webhook endpoint (only created if webhook_url is provided)
resource "stripe_webhook_endpoint" "webhook" {
  count = var.webhook_url != "" ? 1 : 0

  url = var.webhook_url
  enabled_events = [
    "invoice.payment_succeeded",
    "invoice.payment_failed",
    "invoice.finalized",
    "customer.subscription.deleted",
  ]
}

# Outputs
output "basic_product_id" {
  description = "The ID of the Basic product"
  value       = stripe_product.basic.id
}

output "premium_product_id" {
  description = "The ID of the Premium product"
  value       = stripe_product.premium.id
}

output "basic_price_id" {
  description = "The ID of the Basic price ($5/month)"
  value       = stripe_price.basic_monthly.id
}

output "premium_price_id" {
  description = "The ID of the Premium price ($9/month)"
  value       = stripe_price.premium_monthly.id
}

output "webhook_endpoint_id" {
  description = "The ID of the webhook endpoint (if created)"
  value       = var.webhook_url != "" ? stripe_webhook_endpoint.webhook[0].id : null
}
