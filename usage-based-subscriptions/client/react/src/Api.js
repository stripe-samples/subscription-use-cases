const createCustomer = async (name, email) => {
  try {
    const res = await fetch('/api/create-customer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accepts: 'application/json',
      },
      body: JSON.stringify({ name, email }),
    });
    return await res.json();
  } catch (error) {
    return { error };
  }
};

const createMeter = async (displayName, eventName, aggregationFormula) => {
  try {
    const res = await fetch('/api/create-meter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accepts: 'application/json',
      },
      body: JSON.stringify({ displayName, eventName, aggregationFormula }),
    });
    return await res.json();
  } catch (error) {
    return { error };
  }
};

const createPrice = async (meterId, currency, amount, productName) => {
  try {
    const res = await fetch('/api/create-price', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accepts: 'application/json',
      },
      body: JSON.stringify({ meterId, currency, amount, productName }),
    });
    return await res.json();
  } catch (error) {
    return { error };
  }
};

const createSubscription = async (customerId, priceId) => {
  try {
    const res = await fetch('/api/create-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accepts: 'application/json',
      },
      body: JSON.stringify({ customerId, priceId }),
    });
    return await res.json();
  } catch (error) {
    return { error };
  }
};

const createMeterEvent = async (eventName, customerId, value) => {
  try {
    const res = await fetch('/api/create-meter-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accepts: 'application/json',
      },
      body: JSON.stringify({ eventName, customerId, value }),
    });
    return await res.json();
  } catch (error) {
    return { error };
  }
};

export {
  createCustomer,
  createMeter,
  createPrice,
  createSubscription,
  createMeterEvent,
};
