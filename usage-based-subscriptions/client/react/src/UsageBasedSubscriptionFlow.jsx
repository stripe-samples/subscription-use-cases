import React from 'react';
import FlowContainer from './components/FlowContainer';
import { Typography } from 'antd';
import CreateCustomerForm from './steps/CreateCustomerForm';
import CreateMeterForm from './steps/CreateMeterForm';
import CreatePriceForm from './steps/CreatePriceForm';
import CreateSubscriptionForm from './steps/CreateSubscriptionForm';
import CreateMeterEventForm from './steps/CreateMeterEventForm';
const { Title } = Typography;

import { useSession } from './Session';
import {
  retrievePublishableKey,
  createMeter,
  createCustomer,
  createPrice,
  createSubscription,
} from './Api';
import CollectPaymentMethodForm from './steps/CollectPaymentMethodForm';

const UsageBasedSubscriptionFlow = () => {
  const {
    setPublishableKey,
    displayName,
    eventName,
    aggregationFormula,
    setMeterId,
    meterId,
    customerName,
    customerEmail,
    customerId,
    setCustomerId,
    currency,
    amount,
    productName,
    priceId,
    setPriceId,
    setSubscriptionId,
    setClientSecret,
    addMessage,
    messages,
  } = useSession();

  React.useEffect(async () => {
    const response = await retrievePublishableKey();
    const { publishableKey, error } = response;
    if (publishableKey) {
      addMessage('🔑 Retrieved publishable key');
      setPublishableKey(publishableKey);
    }
    if (error) {
      addMessage(
        `😱 Failed to retrieve publisable key. Is your server running?`
      );
    }
  }, []);

  const [currentStep, setCurrentStep] = React.useState(0);

  const performCreateCustomer = async () => {
    addMessage('🔄 Creating a Customer...');
    const response = await createCustomer(customerName, customerEmail);
    const { customer, error } = response;
    if (customer) {
      addMessage(`✅ Created customer: ${customer.id}`);
      setCustomerId(customer.id);
      return true;
    }
    if (error) {
      addMessage(`❌ Error creating customer: ${error.message}`);
      return false;
    }
  };

  const performCreateMeter = async () => {
    addMessage('🔄 Creating a Meter...');
    const response = await createMeter(
      displayName,
      eventName,
      aggregationFormula
    );
    const { meter, error } = response;
    if (meter) {
      addMessage(`✅ Created meter: ${meter.id}`);
      setMeterId(meter.id);
      return true;
    }
    if (error) {
      addMessage(`❌ Error creating meter: ${error.message}`);
      return false;
    }
  };

  const performCreatePrice = async () => {
    addMessage('🔄 Creating a Price...');
    const response = await createPrice(meterId, currency, amount, productName);
    const { price, error } = response;
    if (price) {
      addMessage(`✅ Created price: ${price.id}`);
      setPriceId(price.id);
      return true;
    }
    if (error) {
      addMessage(`❌ Error creating price: ${error.message}`);
      return false;
    }
  };

  const performCreateSubscription = async () => {
    addMessage('🔄 Creating a Subscription...');
    const response = await createSubscription(customerId, priceId);
    const { subscription, error } = response;
    if (subscription) {
      addMessage(`✅ Created subscription: ${subscription.id}`);
      setSubscriptionId(subscription.id);
      setClientSecret(subscription.pending_setup_intent.client_secret);
      return true;
    }
    if (error) {
      addMessage(`❌ Error creating subscription: ${error.message}`);
      return false;
    }
  };

  const buildSteps = () => {
    return [
      {
        title: 'Customer',
        content: <CreateCustomerForm />,
        task: performCreateCustomer,
      },
      {
        title: 'Meter',
        content: <CreateMeterForm />,
        task: performCreateMeter,
      },
      {
        title: 'Price',
        content: <CreatePriceForm />,
        task: performCreatePrice,
      },
      {
        title: 'Subscription',
        content: <CreateSubscriptionForm />,
        task: performCreateSubscription,
      },
      {
        title: 'Payment Method',
        content: <CollectPaymentMethodForm />,
      },
      {
        title: 'Meter Event',
        content: <CreateMeterEventForm />,
      },
    ];
  };

  return (
    <>
      <Title>Usage Based Subscription Demo</Title>
      <FlowContainer
        steps={buildSteps()}
        messages={messages}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
      />
    </>
  );
};

export default UsageBasedSubscriptionFlow;
