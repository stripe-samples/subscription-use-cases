import React, { useState, useContext, createContext } from 'react';
import { useMessages } from './components/StatusMessages';
const SessionContext = createContext(null);

const SessionProvider = ({ children }) => {
  const [messages, addMessage] = useMessages();

  const [customer, setCustomer] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [eventName, setEventName] = useState(null);
  const [aggregationFormula, setAggregationFormula] = useState('sum');

  return (
    <SessionContext.Provider
      value={{
        messages,
        addMessage,
        displayName,
        setDisplayName,
        eventName,
        setEventName,
        aggregationFormula,
        setAggregationFormula,
        customer,
        setCustomer,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

const useSession = () => useContext(SessionContext);
export default SessionProvider;
export { useSession };
