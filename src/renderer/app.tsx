import React, { lazy, Suspense, useEffect, useMemo } from 'react';
import { Spin } from 'antd';
import { useRecoilValue } from 'recoil';
import { appViewStore, MAIN_VIEWS, optionViewStore } from './store';
import DocumentView from './views/document-view';

import Search from './views/options/search';
import History from './views/options/history';
import Subject from './views/options/subject';
import { OptionView } from '@localtypes/index';

import CustomDocumentsModal from './views/components/modals/custom-documents';
import { LoadingOutlined } from '@ant-design/icons';
import LoadByVisibility from './components/load-by-visibility';
import Bible from './views/options/bible';
import ContainerScrollY from './components/container-scroll-y';
import BackupProfileModal from './views/components/modals/backup-profile-modal';
import WelcomeModal from './views/components/modals/welcome-modal';
import UpdaterModal from './views/components/modals/updater-modal';
import { OtherTraductionsModal } from '@renderer/views/components/modals/other-traductions-modal';
import { SubjectSelectModal } from '@renderer/views/components/modals/subject-select-modal';
import { NoteReferencesModal } from '@renderer/views/components/modals/note-references-modal';
import PdfDocumentDownloader from '@renderer/views/components/pdf-document-downloader';
import DocumentAudioPlayer from '@renderer/views/components/modals/document-audio-player';
import sendIpcRequest from '@root/ipc/ipc-renderer';
import { IPC_EVENTS } from '@root/utils/ipc-events';

const Notes = lazy(() => import('./views/options/notes'));

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

export function ContentApp() {
  const view = useRecoilValue(appViewStore);

  useEffect(() => {
    sendIpcRequest(IPC_EVENTS.app_has_started);
  }, []);

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
      <PdfDocumentDownloader />
      <DocumentAudioPlayer />
    </>
  );
}
