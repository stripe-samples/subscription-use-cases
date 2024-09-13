import React, { useEffect } from 'react'
import { Steps, Button, message } from 'antd'
import StatusMessages from './StatusMessages'

import './FlowContainer.css'
import 'antd/dist/antd.min.css'

const { Step } = Steps
const FlowContainer = ({
  steps,
  messages,
  currentStep,
  setCurrentStep,
  shouldGoToConfirmStep,
}) => {
  useEffect(() => {
    if (shouldGoToConfirmStep) {
      setCurrentStep(steps.map((s) => s.type).indexOf('confirm'))
    }
  }, [shouldGoToConfirmStep, steps, setCurrentStep])

  const next = () => {
    if (currentStep === 0) {
    }
    setCurrentStep(currentStep + 1)
  }

  const prev = () => {
    setCurrentStep(currentStep - 1)
  }

  return (
    <>
      <Steps current={currentStep}>
        {steps.map((step) => (
          <Step key={step.title} title={step.title} />
        ))}
      </Steps>
      <div className="steps-content">{steps[currentStep].content}</div>
      <div className="steps-action">
        {currentStep < steps.length - 1 && (
          <Button type="primary" onClick={() => next()}>
            Next
          </Button>
        )}
        {currentStep === steps.length - 1 && (
          <Button
            type="primary"
            onClick={() => message.success('Processing complete!')}
          >
            Done
          </Button>
        )}
        {currentStep > 0 && (
          <Button style={{ margin: '0 8px' }} onClick={() => prev()}>
            Previous
          </Button>
        )}
      </div>

      <StatusMessages messages={messages} />
    </>
  )
}

export default FlowContainer
