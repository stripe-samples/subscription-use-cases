import React from 'react';
import { Input, InputNumber, DatePicker, Row, Col, Typography } from 'antd';
const { Title } = Typography;

const CreateMeterEventForm = () => {
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
        />
      </Row>
      <Row align="middle" style={{ marginBottom: 8 }}>
        <Col span={8}>
          <Title level={5}>Timestamp</Title>
        </Col>
        <DatePicker
          style={{
            width: '50%',
          }}
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
        />
      </Row>
    </>
  );
};

export default CreateMeterEventForm;
