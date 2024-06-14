import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const Prices = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [prices, setPrices] = useState([]);

  useEffect(() => {
    const fetchPrices = async () => {
      const {prices} = await fetch('api/config').then(r => r.json());
      setPrices(prices);
    };
    fetchPrices();
  }, [])

  const createSubscription = async (priceId) => {
    const {subscriptionId, clientSecret} = await fetch('api/create-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId
      }),
    }).then(r => r.json());

    navigate('/subscribe', {
      state: {
        from: location,
        subscriptionId,
        clientSecret,
      },
      replace: false
    });
  }


  return (
    <div>
      <h1>Select a plan</h1>

      <div className="price-list">
        {prices.map((price) => {
          return (
            <div key={price.id}>
              <h3>{price.product.name}</h3>

              <p>
                ${price.unit_amount / 100} / month
              </p>

              <button onClick={() => createSubscription(price.id)}>
                Select
              </button>
            </div>
          )
        })}
      </div>
    </div>
  );
}

export default Prices;
