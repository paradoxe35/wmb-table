import React, { useEffect } from 'react';
import { render } from 'react-dom';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import frFR from 'antd/lib/locale/fr_FR';
import History from './views/options/history';
import AppLayout from './components/layout';
import './app.global.scss';
import { RecoilRoot, useRecoilState } from 'recoil';
import { appViewState, MAIN_VIEWS } from './store';
import DocumentView from './views/document-view';
import { IPC_EVENTS } from './utils/ipc-events';
import sendIpcRequest from './message-control/ipc/ipc-renderer';

const RouterApp = () => {
  return (
    <Router>
      <Switch>
        <Route path="/" component={History} />
      </Switch>
    </Router>
  );
};

function ContentHandler() {
  const [view, setView] = useRecoilState(appViewState);

  useEffect(() => {
    (async () => {
      const menu_viewer = await sendIpcRequest<string>(IPC_EVENTS.menu_viewer);
      console.log(menu_viewer);

      menu_viewer && setView(menu_viewer);
    })();
  }, []);

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
