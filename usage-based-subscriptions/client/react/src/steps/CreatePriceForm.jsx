import React from 'react';
import { Input, InputNumber, Row, Col, Typography } from 'antd';
const { Title } = Typography;

import { useSession } from '../Session';

const CreatePriceForm = () => {
  const {
    currency,
    setCurrency,
    amount,
    setAmount,
    productName,
    setProductName,
  } = useSession();

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
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
        />
      </Row>
      <Row align="middle" style={{ marginBottom: 8 }}>
        <Col span={8}>
          <Title level={5}>Currency</Title>
        </Col>
        <Input
          style={{
            width: '50%',
          }}
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
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
          value={amount}
          onChange={(value) => setAmount(value)}
        />
      </Row>
    </>
  );
};

export default CreatePriceForm;
