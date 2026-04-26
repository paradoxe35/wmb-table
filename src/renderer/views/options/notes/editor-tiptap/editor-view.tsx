import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { getMarkRange } from '@tiptap/core';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from 'antd';
import { StarterKit } from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { TextAlign } from '@tiptap/extension-text-align';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { Placeholder } from '@tiptap/extension-placeholder';

import { TEXT_PART_LANGUAGE_OPTIONS } from '@shared/constants';
import type { NoteItemReference, NoteItemReferenceBible } from '@shared/types';
import { ContextMenu } from '@renderer/utils/context-menu';
import { debounce, substrAfter } from '@renderer/utils/functions';
import { useIpcRequestWithLoader, useValueStateRef } from '@renderer/hooks';
import { useWmbLinkNavigate } from '@renderer/hooks/use-wmb-link';
import { hasMeaningfulHtmlContent } from '@shared/html-content';

import { ReferenceLink } from './extensions/reference-link';
import { PageBreak } from './extensions/page-break';
import { TextPartLanguage } from './extensions/text-part-language';
import { Indent } from './extensions/indent';
import { EditorToolbar } from './toolbar';
import {
    referenceBibleBrandLink,
    referenceBrandLink as referenceDocumentBrandLink,
    useBibleReferenceModal,
    useShowReferenceDetail,
} from '../references';

const WMB_BRAND_LINK = 'http://w.t/#wmb/';

function findAnchorElement(target: EventTarget | null): HTMLAnchorElement | null {
    let current = target instanceof HTMLElement ? target : null;
    while (current) {
        if (current instanceof HTMLAnchorElement) return current;
        current = current.parentElement;
    }
    return null;
}

export type TiptapEditorHandle = {
    editor: Editor | null;
    getHTML: () => string;
    setHTML: (html: string, opts?: { emitUpdate?: boolean }) => void;
    setEditable: (editable: boolean) => void;
};

export function TiptapEditorView({
    workingNoteId,
    initialContent,
    uiLanguage,
    onChange,
    onContentPresenceChange,
    onReady,
    bibleReferenceModal,
}: {
    workingNoteId: string;
    initialContent: string | null;
    uiLanguage: string;
    onChange: (html: string) => void;
    onContentPresenceChange: (hasContent: boolean) => void;
    onReady: (editor: Editor) => void;
    bibleReferenceModal: ReturnType<typeof useBibleReferenceModal>;
}) {
    const { t } = useTranslation();
    const showReferenceDetail = useShowReferenceDetail();
    const navigateWmbLink = useWmbLinkNavigate();
    const ipcRequestWithLoader = useIpcRequestWithLoader();
    const workingNoteIdRef = useValueStateRef(workingNoteId);

    const onChangeRef = useValueStateRef(onChange);
    const onContentPresenceChangeRef = useValueStateRef(onContentPresenceChange);
    const onReadyRef = useValueStateRef(onReady);
    const navigateWmbLinkRef = useValueStateRef(navigateWmbLink);
    const showReferenceDetailRef = useValueStateRef(showReferenceDetail);
    const showBibleModalRef = useValueStateRef(bibleReferenceModal.showModal);

    const contextEventRef = useRef<MouseEvent | null>(null);
    const debouncedChangeRef = useRef(debounce(() => {}, 1000));

    // Note: extensions list is intentionally a stable reference for the editor's lifetime;
    // language-specific config (textPartLanguage options) is read via TEXT_PART_LANGUAGE_OPTIONS at render-time.
    const extensions = useMemo(
        () => [
            StarterKit.configure({
                link: false,
                heading: { levels: [1, 2, 3, 4, 5, 6] },
            }),
            TextStyleKit.configure({
                backgroundColor: { types: ['textStyle'] },
                color: { types: ['textStyle'] },
                fontFamily: { types: ['textStyle'] },
                fontSize: { types: ['textStyle'] },
            }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            TaskList,
            TaskItem.configure({ nested: true }),
            TableKit.configure({ table: { resizable: true } }),
            Subscript,
            Superscript,
            ReferenceLink.configure({
                openOnClick: false,
                autolink: true,
                linkOnPaste: true,
                protocols: ['http', 'https', 'mailto', 'tel'],
                HTMLAttributes: { rel: 'noopener noreferrer' },
            }),
            PageBreak,
            TextPartLanguage,
            Indent,
            Placeholder.configure({
                placeholder: t('Commencez à écrire votre note…'),
            }),
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const editor = useEditor(
        {
            extensions,
            content: initialContent ?? '',
            editorProps: {
                attributes: {
                    class: 'tiptap-prose cke5-decoupled-custom-document-editable',
                    spellcheck: 'false',
                    lang: uiLanguage,
                },
            },
            onCreate: ({ editor: ed }) => {
                onContentPresenceChangeRef.current(hasMeaningfulHtmlContent(ed.getHTML()));
                onReadyRef.current(ed);
            },
            onUpdate: ({ editor: ed }) => {
                onContentPresenceChangeRef.current(hasMeaningfulHtmlContent(ed.getHTML()));
                debouncedChangeRef.current();
            },
            immediatelyRender: false,
        },
        [workingNoteId],
    );

    // Build the debounced save bound to the live editor.
    useEffect(() => {
        if (!editor) return;
        const debounced = debounce(() => {
            onChangeRef.current(editor.getHTML());
        }, 1000);
        debouncedChangeRef.current = debounced;
        return () => {
            debounced.cancel();
        };
    }, [editor, onChangeRef]);

    // Click handler for our custom links — intercept reference / bible / wmb links.
    useEffect(() => {
        if (!editor) return;
        const dom = editor.view.dom as HTMLElement;

        const handleClick = (event: MouseEvent) => {
            const anchor = findAnchorElement(event.target);
            if (!anchor) return;
            const href = anchor.getAttribute('href');
            if (!href) return;

            const isReference =
                href.startsWith(referenceDocumentBrandLink) ||
                href.startsWith(referenceBibleBrandLink) ||
                href.startsWith(WMB_BRAND_LINK) ||
                href.startsWith('wmb://');

            if (!isReference) return;

            event.preventDefault();
            event.stopPropagation();

            if (href.startsWith(referenceDocumentBrandLink)) {
                const refId = substrAfter(href, referenceDocumentBrandLink);
                ipcRequestWithLoader<NoteItemReference | null>(() =>
                    window.api.notes.getReference(refId),
                ).then((data) => {
                    if (data) showReferenceDetailRef.current(data);
                    else message.error(t('La référence est invalide'));
                });
            } else if (href.startsWith(referenceBibleBrandLink)) {
                const refId = substrAfter(href, referenceBibleBrandLink);
                ipcRequestWithLoader<NoteItemReferenceBible | null>(() =>
                    window.api.notes.getBibleReference(refId),
                ).then((data) => {
                    if (data) showBibleModalRef.current(data);
                    else message.error(t('La référence biblique est invalide'));
                });
            } else if (href.startsWith(WMB_BRAND_LINK)) {
                navigateWmbLinkRef.current('wmb://' + substrAfter(href, WMB_BRAND_LINK));
            } else {
                navigateWmbLinkRef.current(href);
            }
        };

        dom.addEventListener('click', handleClick);
        return () => {
            dom.removeEventListener('click', handleClick);
        };
    }, [
        editor,
        ipcRequestWithLoader,
        navigateWmbLinkRef,
        showBibleModalRef,
        showReferenceDetailRef,
        t,
    ]);

    // Right-click context menu mirroring the legacy behavior.
    useEffect(() => {
        if (!editor) return;
        const dom = editor.view.dom as HTMLElement;
        const container = (dom.parentElement ?? dom) as HTMLElement;

        const captureContext = (e: MouseEvent) => {
            contextEventRef.current = e;
        };

        const refereToDocument = async (type: 'document' | 'bible') => {
            if (!contextEventRef.current?.target) return;
            const anchor = findAnchorElement(contextEventRef.current.target);
            const onExistingRef =
                anchor &&
                (anchor.getAttribute('href')?.startsWith(referenceDocumentBrandLink) ||
                    anchor.getAttribute('href')?.startsWith(referenceBibleBrandLink));
            if (onExistingRef) return;

            const selected = window.getSelection()?.toString().trim();
            if (!selected || selected.length <= 1) {
                message.error(t('Aucune sélection trouvée pour la référence'));
                return;
            }

            if (type === 'document') {
                const ref = await ipcRequestWithLoader<NoteItemReference>(() =>
                    window.api.notes.createReference(workingNoteIdRef.current, selected),
                );
                editor
                    .chain()
                    .focus()
                    .extendMarkRange('link')
                    .setLink({
                        href: referenceDocumentBrandLink + ref.id,
                        target: null,
                        // @ts-expect-error — extra attributes added via custom extension
                        reference: 'true',
                        title: t('Référence document'),
                    })
                    .run();
                message.success(t('Référence document: {{label}}', { label: ref.label }));
            } else {
                const ref = await ipcRequestWithLoader<NoteItemReferenceBible>(() =>
                    window.api.notes.createBibleReference(workingNoteIdRef.current, selected),
                );
                editor
                    .chain()
                    .focus()
                    .extendMarkRange('link')
                    .setLink({
                        href: referenceBibleBrandLink + ref.id,
                        target: null,
                        // @ts-expect-error — extra attributes added via custom extension
                        reference: 'true',
                        bible: 'true',
                        title: t('Référence biblique'),
                    })
                    .run();
                message.success(t('Référence biblique: {{label}}', { label: ref.label }));
                showBibleModalRef.current(ref);
            }
        };

        const deleteReference = async () => {
            if (!contextEventRef.current?.target) {
                message.warning(t('Cliquez droit sur une référence pour la supprimer'));
                return;
            }
            const anchor = findAnchorElement(contextEventRef.current.target);
            const href = anchor?.getAttribute('href');
            if (!anchor || !href) {
                message.warning(t('Cliquez droit sur une référence pour la supprimer'));
                return;
            }
            const isDoc = href.startsWith(referenceDocumentBrandLink);
            const isBible = href.startsWith(referenceBibleBrandLink);
            if (!isDoc && !isBible) {
                message.warning(t('Cliquez droit sur une référence pour la supprimer'));
                return;
            }
            const refId = isDoc
                ? substrAfter(href, referenceDocumentBrandLink)
                : substrAfter(href, referenceBibleBrandLink);
            await window.api.notes.deleteReference(refId);

            try {
                const pos = editor.view.posAtDOM(anchor, 0);
                const $pos = editor.state.doc.resolve(pos);
                const linkType = editor.schema.marks.link;
                const range = getMarkRange($pos, linkType);
                if (range) {
                    editor
                        .chain()
                        .focus()
                        .setTextSelection({ from: range.from, to: range.to })
                        .unsetLink()
                        .run();
                }
            } catch {
                // best-effort — DB row already deleted, leave the visible link if mapping fails.
            }
            message.success(t('Référence supprimée'));
        };

        const copySelection = async () => {
            const selected = window.getSelection()?.toString().trim();
            if (!selected) {
                message.error(t('Impossible de copier le texte.'));
                return;
            }
            try {
                await navigator.clipboard.writeText(selected);
                message.success(t('Texte copié'));
            } catch {
                message.error(t('Impossible de copier le texte.'));
            }
        };

        const menu = new ContextMenu(container, [
            { text: t('Référence document'), onclick: () => void refereToDocument('document') },
            { text: t('Référence biblique'), onclick: () => void refereToDocument('bible') },
            { text: t('Copier'), onclick: () => void copySelection() },
            null,
            {
                text: t('Supprimer la référence'),
                onclick: () => void deleteReference(),
                color: 'var(--ant-color-error)',
            },
        ]);
        menu.container.addEventListener('contextmenu', captureContext);
        menu.install();

        return () => {
            menu.uninstall();
            menu.container.removeEventListener('contextmenu', captureContext);
        };
    }, [editor, ipcRequestWithLoader, showBibleModalRef, t, workingNoteIdRef]);

    if (!editor) {
        return <div className="editor-scroll" />;
    }

    return (
        <>
            <EditorToolbar editor={editor} />
            <div className="editor-scroll">
                <div className="tiptap-editor-frame">
                    <EditorContent editor={editor} />
                </div>
            </div>
        </>
    );
}

// Re-export so consumers can ensure the language list is in sync.
export const TIPTAP_TEXT_PART_LANGUAGES = TEXT_PART_LANGUAGE_OPTIONS;
