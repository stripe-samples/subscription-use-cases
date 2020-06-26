import React, { useState } from 'react';
import { withRouter } from 'react-router-dom';
import TopNavigationBar from './TopNavigationBar';
import StripeSampleFooter from './StripeSampleFooter';
import PaymentForm from './PaymentForm';
import Product from './Product';

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

function Prices({ location }) {
  const [productSelected, setProduct] = useState(null);
  const [customer] = useState(location.state.customer);

  function handleClick(key) {
    setProduct(products[key]);
  }

  return (
    <div className="p-6">
      <TopNavigationBar />
      <div className="flex flex-wrap justify-center">
        <div className="md:w-1/3 w-full mr-4 md:mb-8">
          <div className="text-center text-pasha font-bold text-2xl mt-4 mb-6">
            Subscribe to a plan
          </div>

          <div className="flex justify-between mb-8">
            {products.map((product, index) => {
              return (
                <Product
                  key={index}
                  product={product}
                  handleClick={handleClick}
                />
              );
            })}
          </div>
          {productSelected ? (
            <PaymentForm
              productSelected={productSelected}
              customer={customer}
            />
          ) : null}
        </div>
      </div>

      <StripeSampleFooter />
    </div>
  );
}

export default withRouter(Prices);
