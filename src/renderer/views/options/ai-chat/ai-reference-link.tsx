import type React from 'react';
import { Tag } from 'antd';
import { useOpenDocument, useOpenCustomDocument, useOpenBibleChapter } from '@renderer/hooks';
import { useSermonStore } from '@renderer/stores/sermon.store';

/**
 * Reference link format: wmb://<type>/<...params>
 *
 * - wmb://sermon/<sermonId>/<translationId>/<paragraphIndex>
 * - wmb://bible/<bookCode>/<chapter>/<verse>/<bookName>
 * - wmb://doc/<documentId>/<title>
 */

interface SermonRef {
    type: 'sermon';
    sermonId: string;
    translationId: number;
    paragraphIndex: number;
}

interface BibleRef {
    type: 'bible';
    bookCode: string;
    chapter: string;
    verse?: string;
    bookName: string;
}

interface DocRef {
    type: 'doc';
    documentId: string;
    title: string;
}

type WmbRef = SermonRef | BibleRef | DocRef;

function parseWmbLink(href: string): WmbRef | null {
    if (!href.startsWith('wmb://')) return null;

    const parts = href.slice(6).split('/').map(decodeURIComponent);
    const refType = parts[0];

    switch (refType) {
        case 'sermon': {
            const [, sermonId, translationId, paragraphIndex] = parts;
            if (!sermonId) return null;
            return {
                type: 'sermon',
                sermonId,
                translationId: parseInt(translationId ?? '0', 10),
                paragraphIndex: parseInt(paragraphIndex ?? '0', 10),
            };
        }
        case 'bible': {
            const [, bookCode, chapter, verse, ...bookNameParts] = parts;
            if (!bookCode || !chapter) return null;
            return {
                type: 'bible',
                bookCode,
                chapter,
                verse: verse || undefined,
                bookName: bookNameParts.join('/') || bookCode,
            };
        }
        case 'doc': {
            const [, documentId, ...titleParts] = parts;
            if (!documentId) return null;
            return {
                type: 'doc',
                documentId,
                title: titleParts.join('/') || documentId,
            };
        }
        default:
            return null;
    }
}

const REF_COLORS = {
    sermon: 'blue',
    bible: 'green',
    doc: 'orange',
};

export default function AiReferenceLink(
    props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown },
) {
    const { href, children } = props;
    const openDocument = useOpenDocument();
    const openCustomDocument = useOpenCustomDocument();
    const openBibleChapter = useOpenBibleChapter();
    const setPendingNavigation = useSermonStore((s) => s.setPendingNavigation);
    const sermonsById = useSermonStore((s) => s.sermonsById);

    if (!href) return <a>{children}</a>;

    const ref = parseWmbLink(href);
    if (!ref) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
            </a>
        );
    }

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        switch (ref.type) {
            case 'sermon': {
                const sermon = sermonsById[ref.sermonId];
                const title = sermon?.title ?? ref.sermonId;
                setPendingNavigation({
                    documentTitle: title,
                    documentHtmlTree: {
                        paragraphIndex: ref.paragraphIndex,
                        translationId: ref.translationId || sermon?.translationId || 0,
                        languageCode: '',
                        sermonId: ref.sermonId,
                        documentType: 'sermon',
                    },
                });
                openDocument(title, ref.sermonId, ref.translationId || sermon?.translationId);
                break;
            }

            case 'bible':
                openBibleChapter(ref.bookName, ref.bookCode, ref.chapter);
                break;

            case 'doc':
                openCustomDocument(ref.title, ref.documentId);
                break;
        }
    };

    return (
        <Tag
            color={REF_COLORS[ref.type]}
            onClick={handleClick}
            style={{ cursor: 'pointer', fontSize: '0.85em' }}
            bordered={false}
        >
            {children}
        </Tag>
    );
}
