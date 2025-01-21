import React from 'react';
import {
  PaymentElement,
  Elements,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

import { Typography, Row, Col, Button } from 'antd';
const { Title } = Typography;
import { useSession } from '../Session';

const SetupForm = () => {
  const stripe = useStripe();
  const elements = useElements();

  const { addMessage } = useSession();

  const performConfirmSetup = async () => {
    addMessage('🔄 Confirming Setup Intent...');
    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: 'http://localhost:1234',
      },
      redirect: 'if_required',
    });
    if (error) {
      addMessage(`❌ Error confirming setup intent: ${error.message}`);
    } else {
      addMessage('✅ Confirmed Setup Intent');
    }
  };

  return (
    <>
      <Title level={4}>Collect a Payment Method</Title>
      <PaymentElement />
      <Row align="middle">
        <Col span={8}>
          <Button onClick={performConfirmSetup}>Confirm</Button>
        </Col>
      </Row>
    </>
  );
};
const CollectPaymentMethodForm = () => {
  const { publishableKey, clientSecret } = useSession();

  return (
    <Elements
      stripe={loadStripe(publishableKey)}
      options={{
        clientSecret,
      }}
    >
      <SetupForm />
    </Elements>
  );
};
export default CollectPaymentMethodForm;
