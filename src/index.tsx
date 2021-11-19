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
import CustomDocumentsModal from './renderer/views/components/modals/custom-documents';
import { LoadingOutlined } from '@ant-design/icons';
import LoadByVisibility from './renderer/components/load-by-visibility';
import Bible from './renderer/views/options/bible';
import ContainerScrollY from './renderer/components/container-scroll-y';
import BackupProfileModal from './renderer/views/components/modals/backup-profile-modal';
import WelcomeModal from './renderer/views/components/modals/welcome-modal';
import UpdaterModal from './renderer/views/components/modals/updater-modal';
import { OtherTraductionsModal } from '@renderer/views/components/modals/other-traductions-modal';
import { SubjectSelectModal } from '@renderer/views/components/modals/subject-select-modal';
import { NoteReferencesModal } from '@renderer/views/components/modals/note-references-modal';

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
      {/* independent components */}
      <CustomDocumentsModal />
      <BackupProfileModal />
      <WelcomeModal />
      <UpdaterModal />
      <OtherTraductionsModal />
      <SubjectSelectModal />
      <NoteReferencesModal />
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
