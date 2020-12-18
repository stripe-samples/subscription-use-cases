# This utility is to help ensure the sample is configured correctly when first
# getting started.
#
# Refer to `server.rb` for integration details.
require 'stripe'

class ConfigHelper
  REQUIRED_VARS = [
    'BASIC',
    'PREMIUM',
    'STATIC_DIR',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ]

  def self.check_env!(*args)
    helper = self.new(*args)

    # Confirms the required environment variables have
    # been configured.
    bail if !helper.dotenv_exists?

    # Confirms API keys are set and have the expected
    # prefixes.
    bail if !helper.valid_api_keys?

    # Once we've done basic key validation, we can set the API
    # key and make deeper assumptions.
    Stripe.api_key = ENV['STRIPE_SECRET_KEY']

    bail if !helper.valid_paths?
    bail if !helper.valid_prices?
  end

  def self.bail
    puts ""
    puts "Please restart the server and try again."
    exit
  end

  def initialize(*args)
    @vars = Dotenv.parse(*args)
  end

  def set_dotenv!(key, value)
    @vars[key] = value
    write_dotenv!
  end

  def write_dotenv!
    File.open('.env', 'w') do |f|
      REQUIRED_VARS.each do |v|
        f.puts "#{v}=#{@vars[v]}"
      end
    end
  end

  def valid_prices?
    _valid_price?('BASIC', 1200) &&
      _valid_price?('PREMIUM', 1800)
  end

  def _valid_price?(price_id, unit_amount)
    price = ENV[price_id]
    if price.nil? || price == '' || price.include?('...')
      puts <<~DOC
        Environment variable missing for #{price_id}. This should be the ID
        of a Price object in your Stripe account. You can create a product and related prices in the dashbaord here: https://dashboard.stripe.com/test/products.
        Would you like us to create a Price now? [Y/n]
      DOC
      c = gets.chomp
      if c.upcase == "N"
        puts "Please create a Product and Price from the dashboard, then set its ID in .env."
        return false
      else
        stripe_price = Stripe::Price.create(
          unit_amount: 1200,
          currency: "USD",
          recurring: {
            interval: 'month',
          },
          product_data: {
            name: 'Sample Price',
            metadata: {
              stripe_sample_id: 'subscription-use-cases',
              stripe_sample_integration_id: 'fixed-price',
              stripe_sample_lang: 'ruby',
            }
          }
        )
        puts <<~DOC
          Price created!
          #{stripe_price.to_json}
        DOC
        set_dotenv!(price_id, stripe_price.id)
      end
      return false
    end
    true
  end

  def valid_paths?
    static_dir = ENV['STATIC_DIR']
    if static_dir.nil?
      puts <<~DOC
        No STATIC_DIR environment variable found in `.env`. This should be the
        relative path to the directory where the client side HTML code is.
      DOC
      return false
    end
    static_dir_path = File.join(File.dirname(__FILE__), static_dir)
    if !File.directory?(static_dir_path)
      puts <<~DOC
        The path to the STATIC_DIR is not a directory. Please check .env.
      DOC
      return false
    end

    if !File.exists?(File.join(static_dir_path, 'index.html'))
      if static_dir == ''
        puts <<~DOC
          No value set for STATIC_DIR. If this sample was installed with the
          Stripe CLI then STATIC_DIR is usually `../client`. If this sample was
          git cloned, STATIC_DIR is typically set to `../../client/{vanillajs|react}`.
        DOC
        return false
      else
        puts <<~DOC
          No `index.html` file found in #{static_dir_path}. Please check #{File.join(static_dir_path, 'index.html')}
        DOC
      end
      return false
    end

    true
  end

  def valid_api_keys?
    sk = ENV['STRIPE_SECRET_KEY']
    if sk.nil? || (!sk.start_with?('sk_test_') && !sk.start_with?('rk_test_'))
      puts <<~DOC
        Your secret API key (STRIPE_SECRET_KEY) is configured incorrectly or
        doesn't match the expected format. You can find your API keys in the Stripe
        dashboard here: https://dashboard.stripe.com/test/apikeys. Then update
        the .env file.
      DOC
      return false
    end

    pk = ENV['STRIPE_PUBLISHABLE_KEY']
    if pk.nil? || !pk.start_with?('pk_test_')
      puts <<~DOC
        Your publishable API key (STRIPE_PUBLISHABLE_KEY) is configured incorrectly or
        doesn't match the expected format. You can find your API keys in the Stripe
        dashboard here: https://dashboard.stripe.com/test/apikeys. Then update
        the .env file.
      DOC
      return false
    end

    pi = nil
    begin
      pi = Stripe::PaymentIntent.list({
        limit: 1
      }, {
        api_key: sk
      }).data.first
    rescue => e
      puts "Failed testing an API request with your STRIPE_SECRET_KEY `#{sk}` check `.env`: \n\n#{e}"
      return false
    end

    if pi.nil?
      puts "No previous payments found. Unable to confirm if publishable and secret key pair is for the same account."
    end

    if !pi.nil? && !pi.client_secret.nil?
      begin
        pi = Stripe::PaymentIntent.retrieve({
          id: pi.id,
          client_secret: pi.client_secret,
        }, {
          api_key: pk
        })
      rescue Stripe::InvalidRequestError => e
        if e.message.start_with?("No such payment_intent")
          puts <<~DOC
            The secret key and publishable key configured in `.env`
            are misconfigured and are likely not from the same Stripe account or the same
            mode.
          DOC
          return false
        end
      end
    end

    whsec = ENV['STRIPE_WEBHOOK_SECRET']
    if whsec.nil? || !whsec.start_with?('whsec_')
      puts <<~DOC
        Your webhook signing secret (STRIPE_WEBHOOK_SECRET) is configured
        incorrectly or doesn't match the expected format. You can find your webhook
        signing secret in the Stripe dashboard here:
        https://dashboard.stripe.com/test/apikeys. or if testing with the
        Stripe CLI by running:
          stripe listen --print-secret
        Be sure to set that in the .env file.
      DOC
      return false
    end
    true
  end

  def dotenv_exists?
    return true if File.exists?("./.env")

    env_file_path = File.join(File.dirname(__FILE__), '.env')
    if !ENV['STRIPE_SECRET_KEY'] && !File.exist?("./.env")
      puts <<~DOC
        Unable to load the .env file from #{env_file_path}.
        Would you like to automatically create one? [Y/n]"
      DOC

      c = gets.chomp
      if c.upcase == "N"
        puts "Okay, you'll need to set the following environment variables:"
        REQUIRED_VARS.each do |v|
          puts "#{v}="
        end
      else
        write_dotenv!
      end
    end

    false
  end
end
