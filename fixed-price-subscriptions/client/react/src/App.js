import React from 'react';
import './App.css';
import { BrowserRouter as Switch, Route } from 'react-router-dom';
import Register from './Register';
import Subscribe from './Subscribe';
import Prices from './Prices';
import Account from './Account';

function App(props) {
  return (
    <Switch>
      <Route exact path="/">
        <Register />
      </Route>
      <Route path="/prices">
        <Prices />
      </Route>
      <Route path="/subscribe">
        <Subscribe />
      </Route>
      <Route path="/account">
        <Account />
      </Route>
    </Switch>
  );
}

export default App;
