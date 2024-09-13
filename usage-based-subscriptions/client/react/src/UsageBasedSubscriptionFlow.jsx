import React from 'react'
import FlowContainer from './components/FlowContainer'
import { useMessages } from './components/StatusMessages'
import { Typography } from 'antd'
const { Title } = Typography

const UsageBasedSubscriptionFlow = () => {
  const [messages, addMessage] = useMessages()
  const [currentStep, setCurrentStep] = React.useState(0)
  const [shouldGoToConfirmStep, setShouldGoToConfirmStep] =
    React.useState(false)

  const buildSteps = () => {
    return [
      {
        title: 'Meter',
        content: <></>,
      },
      {
        title: 'Price',
        content: <></>,
      },
      {
        title: 'Subscription',
        content: <></>,
      },
      {
        title: 'Meter Event',
        content: <></>,
      },
    ]
  }

  return (
    <>
      <Title>Usage Based Subscription Demo</Title>
      <FlowContainer
        steps={buildSteps()}
        messages={messages}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        shouldGoToConfirmStep={shouldGoToConfirmStep}
      />
    </>
  )
}

export default UsageBasedSubscriptionFlow
