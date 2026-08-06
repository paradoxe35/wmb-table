import { useCallback, useRef, useState } from 'react';
import { parseWmbLink } from '@shared/wmb-link';
import { documentContentToParagraphTexts } from '@shared/book-content';
import { isParagraphReference, type NoteItemReference } from '@shared/types';

import { useWmbLinkNavigate } from '@renderer/hooks/use-wmb-link';
import {
    buildPendingNavigation,
    useDocumentPresentation,
    useOpenDocumentRequest,
    useSermonLookup,
} from '@renderer/hooks';
import { useDocumentTabsStore } from '@renderer/stores';

import {
    resolveBibleFromWmb,
    resolveBookFromWmb,
    resolveDocFromWmb,
    resolveSermonFromWmb,
    truncate,
    DOC_PREVIEW_MAX_CHARS,
} from './resolvers';
import type { ReferenceContent } from './content';

export type UseWmbReferenceModalResult = {
    open: boolean;
    loading: boolean;
    content: ReferenceContent | null;
    onOpen: (() => void) | null;
    onClose: () => void;
    /** Open the modal for a wmb:// link. Returns true if the URL was a valid wmb reference. */
    showFromWmbHref: (href: string) => boolean;
    /** Open the modal for a saved note reference id (sermon or custom document). */
    showFromNoteReference: (refId: string) => void;
};

type ModalState = {
    open: boolean;
    loading: boolean;
    content: ReferenceContent | null;
    onOpen: (() => void) | null;
};

const CLOSED: ModalState = { open: false, loading: false, content: null, onOpen: null };
const LOADING: ModalState = { open: true, loading: true, content: null, onOpen: null };

/**
 * State + async resolution for the reference preview modal. Mount the corresponding
 * <WmbReferenceModal {...result} /> once in your tree, then call `showFromWmbHref` or
 * `showFromNoteReference` from any click handler to open it.
 */
export function useWmbReferenceModal(): UseWmbReferenceModalResult {
    const [state, setState] = useState<ModalState>(CLOSED);

    // Tracks the latest in-flight request so a stale resolution can't overwrite a newer one.
    const requestIdRef = useRef(0);

    const navigateWmbLink = useWmbLinkNavigate();
    const openDocumentRequest = useOpenDocumentRequest();
    const { buildOpenRequest } = useDocumentPresentation();
    const setPendingNavigation = useDocumentTabsStore((s) => s.setPendingNavigation);
    const { getSermonById } = useSermonLookup();

    const showFromWmbHref = useCallback(
        (href: string): boolean => {
            const ref = parseWmbLink(href);
            if (!ref) return false;

            const requestId = ++requestIdRef.current;
            setState(LOADING);

            const promise =
                ref.type === 'sermon'
                    ? resolveSermonFromWmb(ref)
                    : ref.type === 'bible'
                      ? resolveBibleFromWmb(ref)
                      : ref.type === 'book'
                        ? resolveBookFromWmb(ref)
                        : resolveDocFromWmb(ref);

            promise.then((content) => {
                if (requestIdRef.current !== requestId) return;
                setState({
                    open: true,
                    loading: false,
                    content,
                    onOpen: () => {
                        navigateWmbLink(href);
                    },
                });
            });

            return true;
        },
        [navigateWmbLink],
    );

    const showFromNoteReference = useCallback(
        (refId: string) => {
            const requestId = ++requestIdRef.current;
            setState(LOADING);

            window.api.notes.getReference(refId).then(async (note) => {
                if (requestIdRef.current !== requestId) return;
                if (!note) {
                    setState({ ...CLOSED, open: true });
                    return;
                }

                const content = await mapNoteReferenceToContent(note, getSermonById);
                if (requestIdRef.current !== requestId) return;

                const onOpen = note.documentReference
                    ? buildNoteReferenceOpener(
                          note,
                          buildOpenRequest,
                          setPendingNavigation,
                          openDocumentRequest,
                      )
                    : null;

                setState({ open: true, loading: false, content, onOpen });
            });
        },
        [buildOpenRequest, getSermonById, openDocumentRequest, setPendingNavigation],
    );

    const onClose = useCallback(() => {
        setState((prev) => ({ ...prev, open: false }));
    }, []);

    return {
        open: state.open,
        loading: state.loading,
        content: state.content,
        onOpen: state.onOpen,
        onClose,
        showFromWmbHref,
        showFromNoteReference,
    };
}

// ---------------------------------------------------------------------------
// Note-reference helpers
// ---------------------------------------------------------------------------

async function mapNoteReferenceToContent(
    note: NoteItemReference,
    getSermonById: ReturnType<typeof useSermonLookup>['getSermonById'],
): Promise<ReferenceContent | null> {
    const ref = note.documentReference;
    const documentIdentity = ref?.documentIdentity;

    if (!documentIdentity) return null;

    if (documentIdentity.documentType === 'sermon') {
        const sermon = getSermonById(documentIdentity.sermonId);
        const paragraphIndex = ref && isParagraphReference(ref) ? ref.paragraphIndex : null;
        return {
            type: 'sermon',
            title: note.documentTitle || sermon?.title || documentIdentity.sermonId,
            dateMs: sermon?.dateMs ?? null,
            location: sermon?.location ?? null,
            paragraphIndex,
            paragraphText: note.textContent || null,
        };
    }

    if (documentIdentity.documentType === 'custom') {
        let snippet: string | null = note.textContent
            ? truncate(note.textContent, DOC_PREVIEW_MAX_CHARS)
            : null;
        if (!snippet) {
            try {
                const document = await window.api.app.getCustomDocumentContent(
                    documentIdentity.customDocumentId,
                );
                snippet = document
                    ? truncate(
                          documentContentToParagraphTexts(document.content).join('\n'),
                          DOC_PREVIEW_MAX_CHARS,
                      )
                    : null;
            } catch {
                snippet = null;
            }
        }
        return { type: 'doc', title: note.documentTitle, contentSnippet: snippet };
    }

    return null;
}

function buildNoteReferenceOpener(
    note: NoteItemReference,
    buildOpenRequest: ReturnType<typeof useDocumentPresentation>['buildOpenRequest'],
    setPendingNavigation: ReturnType<typeof useDocumentTabsStore.getState>['setPendingNavigation'],
    openDocumentRequest: ReturnType<typeof useOpenDocumentRequest>,
): () => void {
    return () => {
        if (!note.documentReference) return;
        const request = buildOpenRequest(note.documentTitle, note.documentReference);
        setPendingNavigation(buildPendingNavigation(request, note.documentReference));
        openDocumentRequest(request);
    };
}
