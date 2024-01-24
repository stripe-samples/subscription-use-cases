import React from 'react';
import './App.css';
import { BrowserRouter as Switch, Route } from 'react-router-dom';

import Account from './Account';
import Cancel from './Cancel';
import Prices from './Prices';
import Register from './Register';
import Subscribe from './Subscribe';

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
      <Route path="/cancel">
        <Cancel />
      </Route>
    </Switch>
  );
}

export default App;
