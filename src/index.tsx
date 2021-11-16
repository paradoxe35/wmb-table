import React, { lazy, Suspense, useMemo } from 'react';
import { render } from 'react-dom';
import { ConfigProvider, Spin } from 'antd';
import frFR from 'antd/lib/locale/fr_FR';
import AppLayout from './renderer/components/layout';
import './app.global.scss';
import { RecoilRoot, useRecoilValue } from 'recoil';
import { appViewStore, MAIN_VIEWS, optionViewStore } from './renderer/store';
import DocumentView from './renderer/views/document-view';

import Search from './renderer/views/options/search';
import History from './renderer/views/options/history';
import Subject from './renderer/views/options/subject';
import { OptionView } from '@localtypes/index';

import '@modules/context-menu/kali_dark.css';
import CustomDocuments from './renderer/views/components/custom-documents';
import { LoadingOutlined } from '@ant-design/icons';
import LoadByVisibility from './renderer/components/load-by-visibility';
import Bible from './renderer/views/options/bible';
import ContainerScrollY from './renderer/components/container-scroll-y';
import BackupProfile from './renderer/views/components/backup-profile-modal';
import Welcome from './renderer/views/components/welcome-modal';
import Updater from './renderer/views/components/updater-modal';

const Notes = lazy(() => import('./renderer/views/options/notes'));

const Loader: React.FC = ({ children }) => {
  return (
    <LoadByVisibility>
      <Suspense
        fallback={
          <div className="flex flex-center" style={{ marginTop: '2rem' }}>
            <Spin
              indicator={<LoadingOutlined style={{ fontSize: 30 }} spin />}
            />
          </div>
        }
      >
        {children}
      </Suspense>
    </LoadByVisibility>
  );
};

const AppOptions = React.memo(
  (): JSX.Element => {
    const view = useRecoilValue<string>(optionViewStore);
    const views: OptionView = useMemo(
      () => ({
        search: (<Search />) as JSX.Element,
        history: (<History />) as JSX.Element,
        subject: (<Subject />) as JSX.Element,
        editor: (
          <Loader>
            <Notes />
          </Loader>
        ) as JSX.Element,
        bible: (<Bible />) as JSX.Element,
      }),
      []
    );
    //@ts-ignore
    return Object.keys(views).map((k: string) => (
      <ContainerScrollY
        className={`${k}__option__content`}
        key={k}
        hidden={k !== view}
      >
        {/* @ts-ignore */}
        {views[k] as JSX.Element}
      </ContainerScrollY>
    ));
  }
);

function ContentHandler() {
  const view = useRecoilValue(appViewStore);

  return (
    <>
      <div
        id={`app-view-${MAIN_VIEWS.options}`}
        hidden={view !== MAIN_VIEWS.options}
      >
        <AppOptions />
      </div>
      <div
        id={`app-view-${MAIN_VIEWS.document}`}
        hidden={view !== MAIN_VIEWS.document}
      >
        <DocumentView />
      </div>
      <CustomDocuments />
      <BackupProfile />
      <Welcome />
      <Updater />
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
