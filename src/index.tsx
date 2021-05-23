import React from 'react';
import { render } from 'react-dom';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import frFR from 'antd/lib/locale/fr_FR';
import App from './views/options/app';
import AppLayout from './components/layout';
import './app.global.css';
import { RecoilRoot } from 'recoil';
import { useRecoilValue } from 'recoil';
import { appViewState, MAIN_VIEWS } from './store';
import DocumentView from './views/document-view';

const RouterApp = () => {
  return (
    <Router>
      <Switch>
        <Route path="/" component={App} />
      </Switch>
    </Router>
  );
};

function ContentHandler() {
  const view = useRecoilValue(appViewState);
  return (
    <>
      <div
        id={`app-view-${MAIN_VIEWS.options}`}
        hidden={view !== MAIN_VIEWS.options}
      >
        <RouterApp />
      </div>
      <div
        id={`app-view-${MAIN_VIEWS.document}`}
        hidden={view !== MAIN_VIEWS.document}
      >
        <DocumentView />
      </div>
    </>
  );
}

render(
  <RecoilRoot>
    <ConfigProvider locale={frFR}>
      <AppLayout>
        <ContentHandler />
      </AppLayout>
    </ConfigProvider>
  </RecoilRoot>,
  document.getElementById('root')
);
