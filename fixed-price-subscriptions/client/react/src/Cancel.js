import React, { useState } from 'react';
import { withRouter } from 'react-router-dom';
import './App.css';
import { Redirect } from 'react-router-dom';

const Cancel = ({location}) => {
  const [cancelled, setCancelled] = useState(false);

  const handleClick = async (e) => {
    e.preventDefault();

    await fetch('/cancel-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionId: location.state.subscription
      }),
    })

    setCancelled(true);
  };

  if(cancelled) {
    return <Redirect to={`/account`} />
  }

  return (
    <div>
      <h1>Cancel</h1>
      <button onClick={handleClick}>Cancel</button>
    </div>
  )
}


export default withRouter(Cancel);
