import React from 'react';
import './App.css';

function StripeSampleFooter() {
  return (
    <div>
      <div className="transition transform fixed bottom-0 inset-x-0 px-2 pb-4 sm:px-0 sm:pb-6">
        <a
          href="https://github.com/stripe-samples"
          className="flex items-center justify-between rounded-lg shadow-lg pl-6 pr-4 py-3 bg-white sm:hidden"
        >
          <p className="text-pasha">
            <strong className="font-medium">View </strong>
            Stripe sample code
          </p>
          <span className="flex items-center justify-center px-3 py-2 border text-base leading-6 font-medium rounded-md text-gray-900 bg-white hover:text-gray-600 focus:outline-none focus:shadow-outline transition ease-in-out duration-150">
            →
          </span>
        </a>
        <div className="hidden sm:block max-w-8xl mx-auto px-4 lg:px-6">
          <div className="py-3 pl-6 pr-3 rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between flex-wrap">
              <div className="w-full flex-1 flex items-center sm:w-0">
                <p className="text-white truncate">
                  <strong className="font-medium text-pasha md:hidden">
                    This is a Stripe Sample
                  </strong>
                  <strong className="hidden md:inline font-medium text-pasha">
                    This is a Stripe Sample
                  </strong>
                  <span className="lg:hidden text-pasha">
                    with Fixed Price Subscriptions with Cards. View code on
                    GitHub.
                  </span>

                  <span className="hidden lg:inline text-pasha">
                    with Fixed Price Subscriptions with Cards. View code on
                    GitHub.
                  </span>
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="rounded-md shadow-sm">
                  <a
                    href="https://stripe.com/docs/billing"
                    className="flex items-center justify-center px-4 py-2 border text-sm leading-5 font-medium rounded text-pasha bg-white hover:text-gray-600 focus:outline-none focus:shadow-outline transition ease-in-out duration-150"
                  >
                    View the guide →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <footer className="h-24"></footer>
    </div>
  );
}

export default StripeSampleFooter;
