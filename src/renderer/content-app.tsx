import { lazy, memo, Suspense, useMemo, type FC, type ReactElement, type ReactNode } from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useAppStore } from './stores';

import Search from './views/options/search';
import History from './views/options/history';
import Subject from './views/options/subject';
import Bible from './views/options/bible';
import SetupView from './views/setup/setup-view';

import DocumentView from './views/document-view';
import ContainerScrollY from './components/container-scroll-y';
import LoadByVisibility from './components/load-by-visibility';

import CustomDocumentsModal from './views/components/modals/custom-documents';
import BackupProfileModal from './views/components/modals/backup-profile-modal';
import WelcomeModal from './views/components/modals/welcome-modal';
import UpdaterModal from './views/components/modals/updater-modal';
import { OtherTraductionsModal } from './views/components/modals/other-traductions-modal';
import { SubjectSelectModal } from './views/components/modals/subject-select-modal';
import { NoteReferencesModal } from './views/components/modals/note-references-modal';
import PdfDocumentDownloader from './views/components/pdf-document-downloader';
import DocumentAudioPlayer from './views/components/modals/document-audio-player';
import LanguageManagerModal from './views/components/modals/language-manager-modal';

const Notes = lazy(() => import('./views/options/notes'));

const Loader: FC<{ children?: ReactNode }> = ({ children }) => {
    return (
        <LoadByVisibility>
            <Suspense
                fallback={
                    <div className="flex flex-center" style={{ marginTop: '2rem' }}>
                        <Spin indicator={<LoadingOutlined style={{ fontSize: 30 }} spin />} />
                    </div>
                }
            >
                {children}
            </Suspense>
        </LoadByVisibility>
    );
};

const AppOptions = memo(function AppOptions(): ReactElement {
    const view = useAppStore((s) => s.optionView);
    const views: Record<string, ReactElement> = useMemo(
        () => ({
            search: <Search />,
            history: <History />,
            subject: <Subject />,
            editor: (
                <Loader>
                    <Notes />
                </Loader>
            ),
            bible: <Bible />,
        }),
        [],
    );

    return (
        <>
            {Object.keys(views).map((k: string) => (
                <ContainerScrollY className={`${k}__option__content`} key={k} hidden={k !== view}>
                    {views[k]}
                </ContainerScrollY>
            ))}
        </>
    );
});

export function ContentApp() {
    const needsSetup = useAppStore((s) => s.needsSetup);
    const mainView = useAppStore((s) => s.mainView);

    if (needsSetup) return <SetupView />;

    return (
        <>
            <div id="app-view-options" hidden={mainView !== 'options'}>
                <AppOptions />
            </div>
            <div id="app-view-document" hidden={mainView !== 'document'}>
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
            <LanguageManagerModal />
        </>
    );
}
