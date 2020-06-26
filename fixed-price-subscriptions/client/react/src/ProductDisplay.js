import React from 'react';

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

function ProductDisplay(props) {
  function handleClick(key) {
    console.log(key);
    props.setShowPreviewInvoiceConfirmation(true);
    // setProduct(products[key]);
  }

  return (
    <div className="flex justify-between mt-8 mb-8">
      {products.map((product, index) => {
        console.log(product);
        return (
          <Product key={index} product={product} handleClick={handleClick} />
        );
      })}
    </div>
  );
}

export default ProductDisplay;
