import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Empty, Modal } from 'antd';
import type { BookChapter } from '@shared/types';
import { DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import { scrollToParagraph } from '@renderer/utils/scroll-to-paragraph';

const INDENT_PER_LEVEL_PX = 14;

export default function ChapterNavigatorModal({
    open,
    onClose,
    chapters,
}: {
    open: boolean;
    onClose: () => void;
    chapters: BookChapter[];
}) {
    const { t } = useTranslation();

    const scrollTo = useCallback(
        (paragraphIndex: number) => {
            onClose();
            requestAnimationFrame(() => {
                const container = document.getElementById(DOCUMENT_CONTAINER_ID);
                scrollToParagraph(container, paragraphIndex);
            });
        },
        [onClose],
    );

    return (
        <Modal
            title={t('Sélectionnez un chapitre')}
            open={open}
            footer={null}
            onCancel={onClose}
            width={480}
        >
            <div className="modal-scroll-area">
                {chapters.length === 0 ? (
                    <Empty description={t('Aucun chapitre')} />
                ) : (
                    chapters.map((chapter) => (
                        <button
                            key={chapter.id}
                            type="button"
                            className="chapter-navigator__item"
                            style={{
                                paddingInlineStart:
                                    Math.max(0, chapter.level - 1) * INDENT_PER_LEVEL_PX,
                            }}
                            onClick={() => scrollTo(chapter.firstParagraph)}
                        >
                            {chapter.title}
                        </button>
                    ))
                )}
            </div>
        </Modal>
    );
}
