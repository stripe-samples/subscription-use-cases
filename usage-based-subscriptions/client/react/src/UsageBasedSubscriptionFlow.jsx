import React from 'react'
import FlowContainer from './components/FlowContainer'
import { useMessages } from './components/StatusMessages'
import { Typography } from 'antd'
import CreateMeterForm from './steps/CreateMeterForm'
import CreatePriceForm from './steps/CreatePriceForm'
import CreateSubscriptionForm from './steps/CreateSubscriptionForm'
import CreateMeterEventForm from './steps/CreateMeterEventForm'
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
        content: <CreateMeterForm />,
      },
      {
        title: 'Price',
        content: <CreatePriceForm />,
      },
      {
        title: 'Subscription',
        content: <CreateSubscriptionForm />,
      },
      {
        title: 'Meter Event',
        content: <CreateMeterEventForm />,
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
