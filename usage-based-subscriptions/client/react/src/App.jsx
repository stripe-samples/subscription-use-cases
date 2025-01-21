import React from 'react';
import 'antd/dist/antd.min.css';
import './App.css';
import SessionProvider from './Session';
import UsageBasedSubscriptionFlow from './UsageBasedSubscriptionFlow';

const App = () => {
  return (
    <div className="App">
      <SessionProvider>
        <UsageBasedSubscriptionFlow />
      </SessionProvider>
    </div>
  );
};

export default App;
