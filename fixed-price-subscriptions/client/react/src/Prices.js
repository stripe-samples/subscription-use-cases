import React, { useState } from 'react';
import { withRouter } from 'react-router-dom';
import { Redirect } from 'react-router-dom';

const Prices = () => {
  const [priceLookupKey, setPriceLookupKey] = useState(null);

  if (priceLookupKey) {
    return <Redirect to={{
      pathname: '/subscribe',
      state: { priceLookupKey }
    }} />
  }

  return (
    <div>
      <h1>Select a plan</h1>

      <div className="price-list">
        <div>
          <h3>Basic</h3>

          <p>
            $5.00 / month
          </p>

          <button onClick={setPriceLookupKey.bind(null, "basic")}>
            Select
          </button>
        </div>

        <div>
          <h3>Premium</h3>

          <p>
            $15.00 / month
          </p>

          <button onClick={setPriceLookupKey.bind(null, "premium")}>
            Select
          </button>
        </div>
      </div>
    </div>
  );
}

export default withRouter(Prices);
