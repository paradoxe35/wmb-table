import { useCallback, useEffect, useState } from 'react';
import { Button, Tooltip } from 'antd';
import { UnorderedListOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { CustomDocumentReaderView } from './custom-document-reader';
import ChapterNavigatorModal from './chapter-navigator-modal';
import { formatBookCitation } from '@shared/book-content';
import { buildBookCitationLink, type BookViewModel, type ReaderContent } from './book-structure';
import { selectedParagraphIndex, useCustomDocumentReader, type BuildReaderCitation } from './hooks';

const buildBookCitation: BuildReaderCitation = (content: ReaderContent, target) => {
    const book = content.book;
    if (!book || !target) {
        return null;
    }

    return {
        label: (paragraphIndex) => {
            const citation = book.citations.get(paragraphIndex);
            return citation ? formatBookCitation(citation) : null;
        },
        link: (paragraphIndex) => {
            const citation = book.citations.get(paragraphIndex);
            return citation ? buildBookCitationLink(target.id, target.title, citation) : null;
        },
    };
};

/** Citation of whatever the reader has selected, so a quote can be cited as it is made. */
function useSelectionCitation(book: BookViewModel | null): string | null {
    const [citation, setCitation] = useState<string | null>(null);

    useEffect(() => {
        if (!book) {
            setCitation(null);
            return;
        }

        const handler = () => {
            const paragraphIndex = selectedParagraphIndex();
            const found = paragraphIndex === null ? null : book.citations.get(paragraphIndex);
            setCitation(found ? formatBookCitation(found) : null);
        };

        document.addEventListener('selectionchange', handler);
        return () => document.removeEventListener('selectionchange', handler);
    }, [book]);

    return citation;
}

export default function BookDocumentView() {
    const { t } = useTranslation();
    const reader = useCustomDocumentReader(buildBookCitation);
    const [chapterModalOpen, setChapterModalOpen] = useState(false);
    const book = reader.content.book;
    const selectionCitation = useSelectionCitation(book);

    const renderBeforeParagraph = useCallback(
        (paragraphIndex: number) => {
            const pageBreak = book?.pageBreaks.get(paragraphIndex);
            if (!pageBreak) {
                return null;
            }

            return (
                <div
                    className="book-page-break"
                    aria-label={t('Page {{page}}', { page: pageBreak.printedPage })}
                >
                    <span className="book-page-break__number">{pageBreak.printedPage}</span>
                </div>
            );
        },
        [book, t],
    );

    // A book whose structure could not be read falls back to the plain reader's
    // paragraph navigator rather than offering an empty chapter list.
    const hasChapters = !!book && book.chapters.length > 0;

    return (
        <>
            <CustomDocumentReaderView
                reader={reader}
                renderBeforeParagraph={book ? renderBeforeParagraph : undefined}
                citation={
                    selectionCitation ? (
                        <span className="book-citation">{selectionCitation}</span>
                    ) : undefined
                }
                navigation={
                    hasChapters ? (
                        <Tooltip title={t('Sélectionnez un chapitre')}>
                            <Button
                                type="text"
                                size="small"
                                icon={<UnorderedListOutlined />}
                                onClick={() => setChapterModalOpen(true)}
                                aria-label={t('Sélectionnez un chapitre')}
                            />
                        </Tooltip>
                    ) : undefined
                }
            />
            {hasChapters && (
                <ChapterNavigatorModal
                    open={chapterModalOpen}
                    onClose={() => setChapterModalOpen(false)}
                    chapters={book.chapters}
                />
            )}
        </>
    );
}
