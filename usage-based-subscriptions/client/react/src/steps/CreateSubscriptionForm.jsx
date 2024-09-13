import React from 'react';
import { Input, Row, Col, Typography } from 'antd';
const { Title } = Typography;

const CreateSubscriptionForm = () => {
  return (
    <>
      <Title level={4}>Create a Subscription</Title>
      <Row align="middle" style={{ marginBottom: 8 }}>
        <Col span={8}>
          <Title level={5}>Customer</Title>
        </Col>
        <Input
          style={{
            width: '50%',
          }}
          disabled
        />
      </Row>
      <Row align="middle">
        <Col span={8}>
          <Title level={5}>Price</Title>
        </Col>
        <Input
          style={{
            width: '50%',
          }}
          disabled
        />
      </Row>
    </>
  );
};

export default CreateSubscriptionForm;
