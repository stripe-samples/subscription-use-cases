import React from 'react';
import { Input, Row, Col, Typography, Select } from 'antd';
const { Title } = Typography;
import { useSession } from '../Session';

const CreateCustomerForm = () => {
  const { name, setName, email, setEmail } = useSession();

  return (
    <>
      <Title level={4}>Create a Customer</Title>
      <Row align="middle" style={{ marginBottom: 8 }}>
        <Col span={8}>
          <Title level={5}>Customer name</Title>
        </Col>
        <Input
          style={{
            width: '50%',
          }}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Row>
      <Row align="middle" style={{ marginBottom: 8 }}>
        <Col span={8}>
          <Title level={5}>Customer email</Title>
        </Col>
        <Input
          style={{
            width: '50%',
          }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Row>
    </>
  );
};

export default CreateCustomerForm;
