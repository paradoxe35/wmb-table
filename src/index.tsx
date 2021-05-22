import React from 'react';
import { render } from 'react-dom';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import frFR from 'antd/lib/locale/fr_FR';
import App from './views/app';
import Layout from './components/layout';
import './app.global.css';

const RouterApp = () => {
  return (
    <Layout>
      <Router>
        <Switch>
          <Route path="/" component={App} />
        </Switch>
      </Router>
    </Layout>
  );
};

render(
  <ConfigProvider locale={frFR}>
    <RouterApp />
  </ConfigProvider>,
  document.getElementById('root')
);
