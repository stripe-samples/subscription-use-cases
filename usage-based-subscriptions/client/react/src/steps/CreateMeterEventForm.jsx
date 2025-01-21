import React from 'react';
import { Input, InputNumber, Row, Col, Typography, Button } from 'antd';
const { Title } = Typography;
import { useSession } from '../Session';
import { createMeterEvent } from '../Api';

const CreateMeterEventForm = () => {
  const { eventName, customerId, addMessage } = useSession();
  const [meterEventValue, setMeterEventValue] = React.useState(0);
  const performCreateMeterEvent = async () => {
    addMessage('🔄 Creating a meter event...');
    const response = await createMeterEvent(
      eventName,
      customerId,
      meterEventValue
    );
    const { meterEvent, error } = response;
    if (meterEvent) {
      addMessage(`✅ Created meter event: ${meterEvent.identifier}`);
      return true;
    }
    if (error) {
      addMessage(`❌ Error creating meter event: ${error.message}`);
      return false;
    }
  };

  return (
    <>
      <Title level={4}>Create a Meter Event</Title>
      <Row align="middle" style={{ marginBottom: 8 }}>
        <Col span={8}>
          <Title level={5}>Event name</Title>
        </Col>
        <Input
          style={{
            width: '50%',
          }}
          disabled
          value={eventName}
        />
      </Row>

      <Row align="middle">
        <Col span={8}>
          <Title level={5}>Value</Title>
        </Col>
        <InputNumber
          style={{
            width: '50%',
          }}
          value={meterEventValue}
          onChange={(value) => setMeterEventValue(value)}
        />
      </Row>
      <Row align="middle">
        <Col span={8}>
          <Button onClick={performCreateMeterEvent}>Submit event</Button>
        </Col>
      </Row>
    </>
  );
};

export default CreateMeterEventForm;
