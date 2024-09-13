import React from 'react';
import { Input, InputNumber, Row, Col, Typography } from 'antd';
const { Title } = Typography;

import { useSession } from '../Session';
import { createMeter } from '../Api';

const CreatePriceForm = () => {
  const { displayName, eventName, aggregationFormula, addMessage } =
    useSession();

  React.useEffect(() => {
    async function performCreateMeter() {
      addMessage('🔄 Creating a Meter...');
      const response = await createMeter(
        displayName,
        eventName,
        aggregationFormula
      );
      const { meter, error } = response;
      if (meter) {
        addMessage(`✅ Created meter: ${meter.id}`);
      }
      if (error) {
        addMessage(`❌ Error creating meter: ${error.message}`);
      }
    }
    performCreateMeter();
  }, []);

  return (
    <>
      <Title level={4}>Create a Price</Title>
      <Row align="middle" style={{ marginBottom: 8 }}>
        <Col span={8}>
          <Title level={5}>Product name</Title>
        </Col>
        <Input
          style={{
            width: '50%',
          }}
        />
      </Row>
      <Row align="middle">
        <Col span={8}>
          <Title level={5}>Unit amount (in cents)</Title>
        </Col>
        <InputNumber
          style={{
            width: '50%',
          }}
        />
      </Row>
    </>
  );
};

export default CreatePriceForm;
