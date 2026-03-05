import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DocumentTabs from '../components/document-tabs';
import { Layout, message } from 'antd';
import {
    useSermonStore,
    useSearchStore,
    useSubjectsStore,
    useAudioStore,
    selectActiveTabTitle,
} from '@renderer/stores';
import { useContainerHeight } from '@renderer/hooks';
import { debounce } from '@renderer/utils/functions';
import type { DocumentViewQuery, SubjectDocumentItem } from '@shared/types';
import { ModalSearchDocument } from './components/modals/modal-search-document';
import {
    CHILD_PARENT_WINDOW_EVENT,
    DOCUMENT_CONTAINER_ID,
    PARENT_WINDOW_EVENT,
    POST_MESSAGE_EVENT,
} from '@renderer/utils/events';

const { Content } = Layout;

const usePostMessage = () => {
    const waitForDocumentViewStarted = useCallback((callback: () => void) => {
        return new Promise<Event>((resolve) => {
            window.addEventListener(CHILD_PARENT_WINDOW_EVENT.documentViewLoaded, resolve, {
                once: true,
            });
            callback();
        });
    }, []);

    const postMessage = useCallback(
        async (iframeEl: HTMLIFrameElement, type: string, detail: unknown, path: string) => {
            await waitForDocumentViewStarted(() => {
                iframeEl.contentWindow?.dispatchEvent(
                    new Event(POST_MESSAGE_EVENT.requestForPostMessage),
                );
            });
            iframeEl.contentWindow?.postMessage({ type, detail }, 'file:///' + path);
        },
        [waitForDocumentViewStarted],
    );

    return postMessage;
};

const useDocumentQuery = (
    titleRef: React.MutableRefObject<string | null>,
    iframeRef: React.MutableRefObject<HTMLIFrameElement | null>,
) => {
    const viewQuery = useSearchStore((s) => s.documentViewQueries);
    const setDocumentViewQuery = useSearchStore((s) => s.setDocumentViewQueries);

    const documentQuery = useRef<DocumentViewQuery | null>(null);

    useEffect(() => {
        const closeDocumentQuery = () => {
            setDocumentViewQuery((qs) => qs.filter((q) => q.documentTitle !== titleRef.current));
        };
        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.closeDocumentQuery, closeDocumentQuery);
        return () => {
            window.removeEventListener(
                CHILD_PARENT_WINDOW_EVENT.closeDocumentQuery,
                closeDocumentQuery,
            );
        };
    }, [setDocumentViewQuery, titleRef]);

    documentQuery.current = useMemo(() => {
        return viewQuery.find((v) => v.documentTitle === titleRef.current) || null;
    }, [titleRef.current, viewQuery]);

    useEffect(() => {
        if (documentQuery.current) {
            window.dispatchEvent(new Event(PARENT_WINDOW_EVENT.frameDocumentSearchStart));
            iframeRef.current?.contentWindow?.location.reload();
        }
    }, [viewQuery, iframeRef]);

    return {
        viewQuery,
        documentQuery,
    };
};

const useSubjectQuery = (iframeRef: React.MutableRefObject<HTMLIFrameElement | null>) => {
    const subjectItemSelected = useSubjectsStore((s) => s.selectedSubjectItem);
    const setSubjectItemSelected = useSubjectsStore((s) => s.setSelectedSubjectItem);

    const subjectItemSelectedRef = useRef(subjectItemSelected);
    subjectItemSelectedRef.current = subjectItemSelected;

    useEffect(() => {
        if (subjectItemSelectedRef.current) {
            iframeRef.current?.contentWindow?.location.reload();
        }
    }, [subjectItemSelected, iframeRef]);

    return {
        subjectItemSelectedRef,
        setSubjectItemSelected,
    };
};

const useSearchQuery = (
    subjectItemSelectedRef: React.MutableRefObject<SubjectDocumentItem | null>,
    setSubjectItemSelected: (s: SubjectDocumentItem | null) => void,
    path: string | null,
    documentQuery: React.MutableRefObject<DocumentViewQuery | null>,
    postMessage: (
        iframeEl: HTMLIFrameElement,
        type: string,
        detail: unknown,
        path: string,
    ) => Promise<void>,
) => {
    const handleSearchQuery = useCallback(
        (iframeEl: HTMLIFrameElement, hasOwnPosition: boolean) => {
            if (subjectItemSelectedRef.current) {
                postMessage(
                    iframeEl,
                    POST_MESSAGE_EVENT.subjectItem,
                    subjectItemSelectedRef.current,
                    path!,
                );
                setSubjectItemSelected(null);
            } else if (documentQuery.current) {
                window.dispatchEvent(new Event(PARENT_WINDOW_EVENT.frameDocumentSearchStart));
                postMessage(
                    iframeEl,
                    POST_MESSAGE_EVENT.documentQuery,
                    documentQuery.current,
                    path!,
                );
            } else if (!hasOwnPosition) {
                const container =
                    iframeEl.contentDocument?.getElementById(DOCUMENT_CONTAINER_ID)
                        ?.firstElementChild?.firstElementChild;
                container
                    ?.querySelector('div')
                    ?.scrollIntoView({ inline: 'center', behavior: 'smooth' });
            }
        },
        [subjectItemSelectedRef, setSubjectItemSelected, path, documentQuery, postMessage],
    );

    useEffect(() => {
        const handler = () => message.warning('Aucun résultat trouvé');
        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.emptySearchquery, handler);
        return () =>
            window.removeEventListener(CHILD_PARENT_WINDOW_EVENT.emptySearchquery, handler);
    }, []);

    return handleSearchQuery;
};

const useDocument = () => {
    const title = useSermonStore(selectActiveTabTitle);
    const titleRef = useRef(title);
    titleRef.current = title;

    const iframeRef = useContainerHeight<HTMLIFrameElement>(40);

    const [path, setPath] = useState<string | null>(null);

    const sermonsByTitle = useSermonStore((s) => s.sermonsByTitle);

    // get document content path
    useEffect(() => {
        if (title) {
            // TODO: replace with window.api.documents.getContentPath when implemented
            // For now, use getSermonContent approach
            setPath(null);
        }
    }, [title]);

    return {
        title,
        titleRef,
        iframeRef,
        path,
        sermonsByTitle,
    };
};

const useDocumentsState = (titleRef: React.MutableRefObject<string | null>) => {
    const pageRef = useRef<HTMLElement | null>(null);
    const tabs = useSermonStore((s) => s.tabs);
    const updateTabScroll = useSermonStore((s) => s.updateTabScroll);
    const updateTabZoom = useSermonStore((s) => s.updateTabZoom);

    useEffect(() => {
        const documentZoom = (e: Event) => {
            const zoom = (e as CustomEvent).detail?.zoom;
            if (titleRef.current && zoom != null) {
                updateTabZoom(titleRef.current, zoom);
            }
            if (pageRef.current) {
                pageRef.current.dispatchEvent(new Event('scroll'));
            }
        };

        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.documentCurrentZoom, documentZoom);
        return () => {
            window.removeEventListener(CHILD_PARENT_WINDOW_EVENT.documentCurrentZoom, documentZoom);
        };
    }, [titleRef, updateTabZoom]);

    return {
        tabs,
        pageRef,
        updateTabScroll,
    };
};

const useOpenDocumentExternalLink = () => {
    useEffect(() => {
        const openLink = (event: Event) => {
            const url = (event as CustomEvent<string>).detail;
            if (url) window.api.app.openExternal(url);
        };

        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.openDocumentExternalLink, openLink);
        return () => {
            window.removeEventListener(
                CHILD_PARENT_WINDOW_EVENT.openDocumentExternalLink,
                openLink,
            );
        };
    }, []);
};

const useToPostMessageCurrentAudioDocumentPlay = (
    iframeRef: React.MutableRefObject<HTMLIFrameElement | null>,
    title: string | null,
    path: string | null,
) => {
    const postMessage = usePostMessage();
    const currentAudioDocumentPlay = useAudioStore((s) => s.currentPlay);

    useEffect(() => {
        if (
            currentAudioDocumentPlay &&
            iframeRef.current &&
            path &&
            title === currentAudioDocumentPlay.documentTitle
        ) {
            postMessage(
                iframeRef.current,
                POST_MESSAGE_EVENT.currentAudioDocumentPlay,
                currentAudioDocumentPlay,
                path,
            );
        }
    }, [currentAudioDocumentPlay, path, iframeRef, title, postMessage]);

    const currentAudioPlayOnLoadDocument = useCallback(() => {
        if (title === currentAudioDocumentPlay?.documentTitle && iframeRef.current && path) {
            postMessage(
                iframeRef.current,
                POST_MESSAGE_EVENT.currentAudioDocumentPlay,
                currentAudioDocumentPlay,
                path,
            );
        }
    }, [path, currentAudioDocumentPlay, title, iframeRef, postMessage]);

    return currentAudioPlayOnLoadDocument;
};

function useAlertFromIframe() {
    useEffect(() => {
        const handler = () => message.warning("Aucun texte n'a été sélectionné pour référence");
        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.noSelectableDocumentText, handler);
        return () =>
            window.removeEventListener(CHILD_PARENT_WINDOW_EVENT.noSelectableDocumentText, handler);
    }, []);
}

export default function DocumentView() {
    const { iframeRef, path, titleRef, title, sermonsByTitle } = useDocument();

    const { documentQuery } = useDocumentQuery(titleRef, iframeRef);

    const postMessage = usePostMessage();

    const { subjectItemSelectedRef, setSubjectItemSelected } = useSubjectQuery(iframeRef);

    const { tabs, pageRef, updateTabScroll } = useDocumentsState(titleRef);

    const handleSearchQuery = useSearchQuery(
        subjectItemSelectedRef,
        setSubjectItemSelected,
        path,
        documentQuery,
        postMessage,
    );

    useOpenDocumentExternalLink();

    useAlertFromIframe();

    const currentAudioPlayOnLoadDocument = useToPostMessageCurrentAudioDocumentPlay(
        iframeRef,
        title,
        path,
    );

    const onIframeLoad = () => {
        if (iframeRef.current && title) {
            const page = iframeRef.current.contentDocument?.querySelector(
                `#${DOCUMENT_CONTAINER_ID}`,
            ) as HTMLElement | null | undefined;

            pageRef.current = page!;

            // post message title datastore
            const sermon = sermonsByTitle[title];
            if (sermon) {
                postMessage(iframeRef.current, POST_MESSAGE_EVENT.documentTitleData, sermon, path!);
            }

            // get active tab
            const tab = tabs.find((t) => t.title === title);

            // handle zoom
            if (tab?.zoom) {
                postMessage(iframeRef.current, POST_MESSAGE_EVENT.documentZoom, tab.zoom, path!);
            }
            if (page) {
                (page.style as unknown as Record<string, unknown>).zoom = (tab?.zoom || 100) + '%';
            }

            let hasOwnPosition = false;
            if ((tab?.scrollY || tab?.scrollX) && page) {
                hasOwnPosition = true;

                if (!(subjectItemSelectedRef.current || documentQuery.current)) {
                    postMessage(
                        iframeRef.current,
                        POST_MESSAGE_EVENT.windowPosition,
                        {
                            top: tab.scrollY || undefined,
                            left: tab.scrollX || undefined,
                        },
                        path!,
                    );

                    page.scrollTo({
                        top: tab.scrollY || undefined,
                        left: tab.scrollX || undefined,
                        behavior: 'smooth',
                    });
                }
            }

            const load = { count: !hasOwnPosition ? 1 : 0 };

            const onScroll = (): number | void => {
                if (load.count === 0) return (load.count = 1);
                setTimeout(() => {
                    if (title) {
                        updateTabScroll(title, page?.scrollTop, page?.scrollLeft);
                    }
                }, 0);
            };

            const externalizeLinkTag = (event: MouseEvent) => {
                const target = event.target as HTMLElement;
                const hasLink = [
                    target,
                    target.parentElement,
                    target.parentElement?.parentElement,
                ].find((el) => el && el.tagName === 'A');
                if (hasLink) {
                    event.preventDefault();
                    const href = hasLink.getAttribute('href');
                    if (href) window.api.app.openExternal(href);
                }
            };

            page?.addEventListener('click', externalizeLinkTag);
            page?.addEventListener('scroll', debounce(onScroll, 500) as EventListener);
            handleSearchQuery(iframeRef.current, hasOwnPosition);
            currentAudioPlayOnLoadDocument();
        }
    };

    return (
        <>
            <DocumentTabs />
            <Content className="mock-browser-content">
                <iframe
                    ref={iframeRef}
                    hidden={!path}
                    width="100%"
                    onLoad={onIframeLoad}
                    src={path || undefined}
                    frameBorder="0"
                />
            </Content>
            <ModalSearchDocument
                iframeRef={iframeRef}
                documentQuery={documentQuery.current}
                title={title ?? ''}
            />
        </>
    );
}
