import { lazy, memo, Suspense, useMemo, type FC, type ReactElement, type ReactNode } from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useAppStore } from './stores';

import Search from './views/options/search';
import History from './views/options/history';
import Subject from './views/options/subject';
import Bible from './views/options/bible';

import DocumentView from './views/document-view';
import ContainerScrollY from './components/container-scroll-y';
import LoadByVisibility from './components/load-by-visibility';

import CustomDocumentsModal from './views/components/modals/custom-documents';
import BackupProfileModal from './views/components/modals/backup-profile-modal';
import UpdaterModal from './views/components/modals/updater-modal';
import { OtherTraductionsModal } from './views/components/modals/other-traductions-modal';
import { SubjectSelectModal } from './views/components/modals/subject-select-modal';
import { NoteReferencesModal } from './views/components/modals/note-references-modal';
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
                <ContainerScrollY
                    className={`${k}__option__content view-panel ${k !== view ? 'view-panel--hidden' : ''}`}
                    key={k}
                >
                    {views[k]}
                </ContainerScrollY>
            ))}
        </>
    );
});

export function ContentApp() {
    const mainView = useAppStore((s) => s.mainView);

    return (
        <>
            <div
                id="app-view-options"
                className={`view-panel ${mainView !== 'options' ? 'view-panel--hidden' : ''}`}
            >
                <AppOptions />
            </div>
            <div
                id="app-view-document"
                className={`view-panel ${mainView !== 'document' ? 'view-panel--hidden' : ''}`}
            >
                <DocumentView />
            </div>
            {/* independent components */}
            <CustomDocumentsModal />
            <BackupProfileModal />
            <UpdaterModal />
            <OtherTraductionsModal />
            <SubjectSelectModal />
            <NoteReferencesModal />
            <DocumentAudioPlayer />
            <LanguageManagerModal />
        </>
    );
}
