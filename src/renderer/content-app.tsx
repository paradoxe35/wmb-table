import { lazy, memo, Suspense, useMemo, type FC, type ReactElement, type ReactNode } from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useAppStore } from './stores';

import LoadByVisibility from './components/load-by-visibility';

import CustomDocumentsModal from './views/components/modals/custom-documents';
import BackupProfileModal from './views/components/modals/backup-profile-modal';
import UpdaterModal from './views/components/modals/updater-modal';
import { OtherTraductionsModal } from './views/components/modals/other-traductions-modal';
import { SubjectSelectModal } from './views/components/modals/subject-select-modal';
import { NoteReferencesModal } from './views/components/modals/note-references-modal';
import DocumentAudioPlayer from './views/components/modals/document-audio-player';
import LanguageManagerModal from './views/components/modals/language-manager-modal';
import HighlightModal from './views/components/modals/highlight-modal';
import SyncListener from './components/sync-listener';

const Search = lazy(() => import('./views/options/search'));
const History = lazy(() => import('./views/options/history'));
const Subject = lazy(() => import('./views/options/subject'));
const Bible = lazy(() => import('./views/options/bible'));
const Notes = lazy(() => import('./views/options/notes'));
const DocumentView = lazy(() => import('./views/document-view'));

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
            search: (
                <Loader>
                    <Search />
                </Loader>
            ),
            history: (
                <Loader>
                    <History />
                </Loader>
            ),
            subject: (
                <Loader>
                    <Subject />
                </Loader>
            ),
            editor: (
                <Loader>
                    <Notes />
                </Loader>
            ),
            bible: (
                <Loader>
                    <Bible />
                </Loader>
            ),
        }),
        [],
    );

    return (
        <>
            {Object.keys(views).map((k: string) => (
                <div
                    className={`${k}__option__content view-panel view-panel--scrollable ${k !== view ? 'view-panel--hidden' : ''}`}
                    key={k}
                >
                    {views[k]}
                </div>
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
                <Suspense
                    fallback={
                        <div className="flex flex-center" style={{ marginTop: '2rem' }}>
                            <Spin indicator={<LoadingOutlined style={{ fontSize: 30 }} spin />} />
                        </div>
                    }
                >
                    <DocumentView />
                </Suspense>
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
            <HighlightModal />
            <SyncListener />
        </>
    );
}
