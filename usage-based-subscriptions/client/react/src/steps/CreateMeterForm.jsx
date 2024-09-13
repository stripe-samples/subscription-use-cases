import React from 'react'
import { Input, Row, Col, Typography } from 'antd'
const { Title } = Typography

const CreateMeterForm = () => {
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
        />
      </Row>
      <Row align="middle">
        <Col span={8}>
          <Title level={5}>Event name</Title>
        </Col>
        <Input
          style={{
            width: '50%',
          }}
        />
      </Row>
    </>
  )
}

export default CreateMeterForm
