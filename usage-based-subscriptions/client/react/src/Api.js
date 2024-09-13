const createMeter = (displayName, eventName, aggregationFormula) => {
  return fetch('/create-meter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accepts: 'application/json',
    },
    body: JSON.stringify({ displayName, eventName, aggregationFormula }),
  }).then((res) => res.json());
};

export { createMeter };
