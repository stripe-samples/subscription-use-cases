import React, { useState, useEffect } from 'react';
import { withRouter } from 'react-router-dom';
import './App.css';
import TopNavigationBar from './TopNavigationBar';
import StripeSampleFooter from './StripeSampleFooter';
import Product from './Product';
import PriceChangeForm from './PriceChangeForm';

const products = [
  {
    key: 0,
    price: '$5.00',
    name: 'Basic',
    interval: 'month',
    billed: 'monthly',
  },
  {
    key: 1,
    price: '$15.00',
    name: 'Premium',
    interval: 'month',
    billed: 'monthly',
  },
];

function Account({ location }) {
  console.log(location);
  const [accountInformation] = useState(location.state.accountInformation);
  let [customerPaymentMethod, setCustomerPaymentmethod] = useState(null);
  let [showChangePriceForm, setShowChangePriceForm] = useState(false);
  let [subscriptionCancelled, setSubscriptionCancelled] = useState(false);
  let [newProductSelected, setNewProdctSelected] = useState('');
  let [selectedProducted, setSelectedProduct] = useState(
    accountInformation.priceId
  );

  useEffect(() => {
    async function fetchData() {
      // You can await here
      const response = await fetch('/retrieve-customer-payment-method', {
        method: 'post',
        headers: {
          'Content-type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethodId: accountInformation.paymentMethodId,
        }),
      });
      const responseBody = await response.json();
      const paymentMethod =
        responseBody.card.brand + ' •••• ' + responseBody.card.last4;

      setCustomerPaymentmethod(paymentMethod);
    }
    fetchData();
  }, [accountInformation.paymentMethodId]);

  function handleChangePriceForm() {
    setShowChangePriceForm(true);
  }

  function handleClick(key) {
    setNewProdctSelected(products[key].name);
  }

  function cancelSubscription() {
    console.log(accountInformation.subscription);
    fetch('/cancel-subscription', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionId: accountInformation.subscription.id,
      }),
    })
      .then((response) => {
        return response.json();
      })
      .then((cancelSubscriptionResponse) => {
        setSubscriptionCancelled(true);
      });
  }

  function resetDemo() {
    localStorage.clear();
    window.location.href = '/';
  }

  return (
    <div className="p-6">
      <TopNavigationBar />
      {subscriptionCancelled ? (
        <div>
          <div className="flex flex-wrap font-bold text-pasha text-xl mt-6 mb-2">
            Subscription canceled
          </div>
          <div>
            <button
              className="bg-pasha hover:bg-white hover:shadow-outline hover:text-pasha hover:border hover:border-black focus:shadow-outline text-white focus:bg-white focus:text-pasha font-light py-2 px-4 rounded"
              type="button"
              onClick={() => resetDemo()}
            >
              Restart demo
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap justify-center mt-4">
            <div className="md:w-2/5 w-full inline-block rounded-md p-4">
              <div
                id="subscription-status-text"
                className="text-center font-bold text-pasha text-2xl"
              >
                Account settings
              </div>
              <div className="mt-4 border rounded p-4">
                <div className="font-bold text-xl mb-2">Account</div>
                <div className="flex justify-between text-gray-600 text-xl">
                  <div>Current price</div>
                  <div className="font-bold text-xl mb-2">
                    {selectedProducted}
                  </div>
                </div>

                <div className="flex justify-between">
                  <div className="text-xl text-gray-600">Credit card</div>
                  <span
                    id="credit-card-last-four"
                    className="font-bold text-xl text-gray-600"
                  >
                    {customerPaymentMethod}
                  </span>
                </div>

                <div
                  className="flex justify-between mt-2 mb-2 text-gray-900 font-bold text-xl cursor-pointer"
                  onClick={() => handleChangePriceForm()}
                >
                  <span>
                    Change pricing plan <span>→</span>
                  </span>
                </div>
                <div
                  className="flex justify-between mt-2 mb-2 text-gray-900 font-bold text-xl cursor-pointer"
                  onClick={() => cancelSubscription()}
                >
                  <span>
                    Cancel subscription <span>→</span>
                  </span>
                </div>
              </div>

              {showChangePriceForm ? (
                <div id="prices-form" className="w-full md:mb-8">
                  <div className="text-center text-pasha font-bold text-2xl mt-4 mb-6">
                    Change pricing plan
                  </div>
                  <div className="flex justify-between mt-8 mb-8">
                    {products.map((product, index) => {
                      let currentProductSelected = false;
                      if (product.name === selectedProducted) {
                        currentProductSelected = true;
                      }
                      return (
                        <Product
                          key={index}
                          product={product}
                          currentProductSelected={currentProductSelected}
                          handleClick={handleClick}
                        />
                      );
                    })}
                  </div>
                  {newProductSelected ? (
                    <PriceChangeForm
                      customerId={accountInformation.subscription.customer}
                      subscriptionId={accountInformation.subscription.id}
                      currentProductSelected={selectedProducted}
                      newProductSelected={newProductSelected}
                      setShowChangePriceForm={setShowChangePriceForm}
                      setSelectedProduct={setSelectedProduct}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <StripeSampleFooter />
    </div>
  );
}

export default withRouter(Account);
