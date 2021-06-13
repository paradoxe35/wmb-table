import React, { useMemo } from 'react';
import { render } from 'react-dom';
import { ConfigProvider } from 'antd';
import frFR from 'antd/lib/locale/fr_FR';
import AppLayout from './components/layout';
import './app.global.scss';
import { RecoilRoot, useRecoilValue } from 'recoil';
import { appViewState, MAIN_VIEWS, optionViewState } from './store';
import DocumentView from './views/document-view';

import Search from './views/options/search';
import History from './views/options/history';
import Subject from './views/options/subject';
import { OptionView } from './types';

const RouterApp = React.memo(
  (): JSX.Element => {
    const view = useRecoilValue<string>(optionViewState);
    const views: OptionView = useMemo(
      () => ({
        search: (<Search />) as JSX.Element,
        history: (<History />) as JSX.Element,
        subject: (<Subject />) as JSX.Element,
      }),
      []
    );
    //@ts-ignore
    return Object.keys(views).map((k: string) => (
      <div key={k} hidden={k !== view}>
        {/* @ts-ignore */}
        {views[k] as JSX.Element}
      </div>
    ));
  }
);

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
