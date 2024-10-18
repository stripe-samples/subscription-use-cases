import React, { useState, useContext, createContext } from 'react';
import { useMessages } from './components/StatusMessages';
const SessionContext = createContext(null);

const SessionProvider = ({ children }) => {
  const [messages, addMessage] = useMessages();
  // For publishable key
  const [publishableKey, setPublishableKey] = useState(null);

  // For customer creation
  const [name, setName] = useState(null);
  const [email, setEmail] = useState(null);
  const [customerId, setCustomerId] = useState(null);

  // For meter creation
  const [displayName, setDisplayName] = useState(null);
  const [eventName, setEventName] = useState(null);
  const [aggregationFormula, setAggregationFormula] = useState('sum');
  const [meterId, setMeterId] = useState(null);

  // For price creation
  const [currency, setCurrency] = useState('usd');
  const [amount, setAmount] = useState(null);
  const [productName, setProductName] = useState(null);
  const [priceId, setPriceId] = useState(null);

  // For subscription creation
  const [subscriptionId, setSubscriptionId] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);

  return (
    <SessionContext.Provider
      value={{
        messages,
        addMessage,
        //publishable key
        publishableKey,
        setPublishableKey,
        // customer
        name,
        setName,
        email,
        setEmail,
        customerId,
        setCustomerId,
        // meter
        displayName,
        setDisplayName,
        eventName,
        setEventName,
        aggregationFormula,
        setAggregationFormula,
        meterId,
        setMeterId,
        // price
        currency,
        setCurrency,
        amount,
        setAmount,
        productName,
        setProductName,
        priceId,
        setPriceId,
        // subscription
        subscriptionId,
        setSubscriptionId,
        clientSecret,
        setClientSecret,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

const useSession = () => useContext(SessionContext);
export default SessionProvider;
export { useSession };
