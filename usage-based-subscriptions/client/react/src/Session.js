import React, { useState, useContext, createContext } from 'react';

const SessionContext = createContext(null);

const SessionProvider = ({ children }) => {
  const [customer, setCustomer] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [eventName, setEventName] = useState(null);
  const [aggregationFormula, setAggregationFormula] = useState('sum');

  return (
    <SessionContext.Provider
      value={{
        customer,
        setCustomer,
        displayName,
        setDisplayName,
        eventName,
        setEventName,
        aggregationFormula,
        setAggregationFormula,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

const useSession = () => useContext(SessionContext);
export default SessionProvider;
export { useSession };
