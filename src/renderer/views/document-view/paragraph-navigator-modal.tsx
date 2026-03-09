import { useCallback, useMemo, useState } from 'react';
import { Button, Empty, Modal, Segmented } from 'antd';
import type { SermonParagraph } from '@shared/types';
import { DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import { scrollToParagraph } from '@renderer/utils/scroll-to-paragraph';

const STEP_OPTIONS = [1, 2, 3, 5, 10] as const;

export default function ParagraphNavigatorModal({
    open,
    onClose,
    paragraphs,
}: {
    open: boolean;
    onClose: () => void;
    paragraphs: SermonParagraph[];
}) {
    const [step, setStep] = useState<number>(3);

    const visibleParagraphs = useMemo(() => {
        if (step === 1) return paragraphs;
        return paragraphs.filter((_, i) => i % step === 0);
    }, [paragraphs, step]);

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
            title="Sélectionnez un paragraphe"
            open={open}
            footer={null}
            onCancel={onClose}
            width={480}
        >
            <div style={{ marginBottom: 12 }}>
                <Segmented
                    size="small"
                    value={step}
                    onChange={(v) => setStep(v as number)}
                    options={STEP_OPTIONS.map((s) => ({ label: `${s}x`, value: s }))}
                    block
                />
            </div>
            <div
                style={{
                    maxHeight: 350,
                    overflow: 'auto',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                }}
            >
                {visibleParagraphs.length === 0 ? (
                    <Empty description="Aucun paragraphe" />
                ) : (
                    visibleParagraphs.map((p) => (
                        <Button
                            key={p.paragraphIndex}
                            size="small"
                            type="dashed"
                            style={{ minWidth: 36 }}
                            onClick={() => scrollTo(p.paragraphIndex)}
                        >
                            {p.paragraphIndex}
                        </Button>
                    ))
                )}
            </div>
        </Modal>
    );
}
