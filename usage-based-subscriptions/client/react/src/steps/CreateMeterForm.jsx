import React from 'react';
import { Input, Row, Col, Typography, Select } from 'antd';
const { Title } = Typography;
const { Option } = Select;
import { useSession } from '../Session';

const CreateMeterForm = () => {
  const {
    displayName,
    setDisplayName,
    eventName,
    setEventName,
    aggregationFormula,
    setAggregationFormula,
  } = useSession();

  return (
    <>
      <Title level={4}>Create a Meter</Title>
      <Row align="middle" style={{ marginBottom: 8 }}>
        <Col span={8}>
          <Title level={5}>Display name</Title>
        </Col>
        <Input
          style={{
            width: '50%',
          }}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </Row>
      <Row align="middle" style={{ marginBottom: 8 }}>
        <Col span={8}>
          <Title level={5}>Event name</Title>
        </Col>
        <Input
          style={{
            width: '50%',
          }}
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
        />
      </Row>
      <Row align="middle">
        <Col span={8}>
          <Title level={5}>Aggregation formula</Title>
        </Col>
        <Select
          style={{ width: '50%' }}
          onChange={(newValue) => {
            setAggregationFormula(newValue);
          }}
          value={aggregationFormula}
        >
          {['sum', 'count'].map((aggregationFormula) => (
            <Option key={aggregationFormula} value={aggregationFormula}>
              {aggregationFormula}
            </Option>
          ))}
        </Select>
      </Row>
    </>
  );
};

export default CreateMeterForm;
