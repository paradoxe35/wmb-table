import { useCallback, useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { Button, Tooltip } from 'antd';
import {
    PauseOutlined,
    SoundOutlined,
    CaretRightOutlined,
    ZoomInOutlined,
    ZoomOutOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import type { HighlightItem } from '@shared/types';
import type { SearchHighlightState } from './hooks';
import SermonParagraphView from './sermon-paragraph';
import { useTtsHighlight } from '@renderer/hooks/use-tts-highlight';
import { useTtsStore, selectCurrentTtsSegment } from '@renderer/stores/tts.store';

// ── Shared TTS controls interface ──

export interface TtsControls {
    canSpeak: boolean;
    incompatibleMessage?: string;
    isPlaying: boolean;
    isPaused: boolean;
    play: () => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
    playFromParagraph: (paragraphIndex: number) => void;
}

// ── TTS play/pause button ──

const ttsActiveStyle = {
    color: 'var(--ant-color-warning)',
    backgroundColor: 'var(--ant-color-warning-bg-hover)',
};

export function TtsButton({ tts }: { tts: TtsControls }) {
    const { t } = useTranslation();

    if (!tts.canSpeak) {
        return (
            <Tooltip
                title={tts.incompatibleMessage ?? t('Aucune voix disponible pour cette langue.')}
            >
                <Button
                    type="text"
                    size="small"
                    icon={<SoundOutlined />}
                    disabled
                    aria-label={t('Lecture audio indisponible')}
                />
            </Tooltip>
        );
    }

    const label = tts.isPlaying
        ? t('Pause voix')
        : tts.isPaused
          ? t('Reprendre la voix')
          : t('Lire à voix haute');

    const handler = tts.isPlaying ? tts.pause : tts.isPaused ? tts.resume : tts.play;
    const isActive = tts.isPlaying || tts.isPaused;

    return (
        <Tooltip title={label}>
            <Button
                type="text"
                size="small"
                icon={tts.isPlaying ? <PauseOutlined /> : <SoundOutlined />}
                onClick={handler}
                aria-label={t('Lire à voix haute')}
                style={isActive ? ttsActiveStyle : undefined}
            />
        </Tooltip>
    );
}

// ── Zoom controls ──

export function ZoomControls({
    zoom,
    onZoomIn,
    onZoomOut,
}: {
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
}) {
    const { t } = useTranslation();
    return (
        <>
            <Tooltip title={t('Zoom arrière')}>
                <Button
                    type="text"
                    size="small"
                    icon={<ZoomOutOutlined />}
                    onClick={onZoomOut}
                    aria-label={t('Zoom arrière')}
                />
            </Tooltip>
            <span style={{ fontSize: 'var(--fs-rel-lg)', minWidth: 50, textAlign: 'center' }}>
                {zoom}%
            </span>
            <Tooltip title={t('Zoom avant')}>
                <Button
                    type="text"
                    size="small"
                    icon={<ZoomInOutlined />}
                    onClick={onZoomIn}
                    aria-label={t('Zoom avant')}
                />
            </Tooltip>
        </>
    );
}

// ── Paragraph list (virtualized) ──

export interface ParagraphListHandle {
    scrollToParagraph: (paragraphIndex: number) => void;
}

/** Global ref to the active document's paragraph list — used by components outside the view tree. */
let activeParagraphList: ParagraphListHandle | null = null;
export function getActiveParagraphList(): ParagraphListHandle | null {
    return activeParagraphList;
}

interface ParagraphListProps {
    paragraphs: { paragraphIndex: number; content: string }[];
    documentId: string;
    search: SearchHighlightState | null;
    activeParagraphIndex: number;
    highlightsByParagraph: Map<number, HighlightItem[]>;
    onPlayFromHere?: (paragraphIndex: number) => void;
    canSpeak?: boolean;
    incompatibleMessage?: string;
    customScrollParent?: HTMLElement | null;
}

export const ParagraphList = forwardRef<ParagraphListHandle, ParagraphListProps>(
    function ParagraphList(
        {
            paragraphs,
            documentId,
            search,
            activeParagraphIndex,
            highlightsByParagraph,
            onPlayFromHere,
            canSpeak,
            incompatibleMessage,
            customScrollParent,
        },
        ref,
    ) {
        const virtuosoRef = useRef<VirtuosoHandle>(null);

        const scrollToParagraph = useCallback(
            (paragraphIndex: number) => {
                const idx = paragraphs.findIndex((p) => p.paragraphIndex === paragraphIndex);
                if (idx >= 0) {
                    virtuosoRef.current?.scrollToIndex({
                        index: idx,
                        align: 'center',
                        behavior: 'auto',
                    });
                    // Trigger blink animation after Virtuoso renders the item
                    requestAnimationFrame(() => {
                        const el = customScrollParent?.querySelector<HTMLElement>(
                            `[data-paragraph-index="${paragraphIndex}"]`,
                        );
                        if (!el) return;
                        el.classList.add('paragraph-highlight-blink');
                        const cleanup = () => el.classList.remove('paragraph-highlight-blink');
                        el.addEventListener('animationend', cleanup, { once: true });
                        setTimeout(cleanup, 2500);
                    });
                }
            },
            [paragraphs, customScrollParent],
        );

        useImperativeHandle(ref, () => ({ scrollToParagraph }), [scrollToParagraph]);

        // Register as the active paragraph list for global access
        useEffect(() => {
            activeParagraphList = { scrollToParagraph };
            return () => {
                activeParagraphList = null;
            };
        }, [scrollToParagraph]);

        // TTS auto-scroll
        const currentSegment = useTtsStore(selectCurrentTtsSegment);
        const autoScroll = useTtsStore((s) => s.settings?.autoScrollToHighlight ?? true);
        const status = useTtsStore((s) => s.status);
        const storeDocumentId = useTtsStore((s) => s.documentId);

        useEffect(() => {
            if (!currentSegment || !autoScroll) return;
            if (storeDocumentId !== documentId) return;
            if (status !== 'playing' && status !== 'loading') return;
            scrollToParagraph(currentSegment.paragraphIndex);
        }, [
            currentSegment?.paragraphIndex,
            autoScroll,
            status,
            storeDocumentId,
            documentId,
            scrollToParagraph,
        ]);

        return (
            <Virtuoso
                ref={virtuosoRef}
                data={paragraphs}
                {...(customScrollParent ? { customScrollParent } : {})}
                increaseViewportBy={1500}
                itemContent={(_index, p) => (
                    <TtsParagraph
                        key={p.paragraphIndex}
                        paragraph={p}
                        documentId={documentId}
                        search={search}
                        isActiveMatch={p.paragraphIndex === activeParagraphIndex}
                        highlights={highlightsByParagraph.get(p.paragraphIndex)}
                        onPlayFromHere={onPlayFromHere}
                        canSpeak={canSpeak}
                        incompatibleMessage={incompatibleMessage}
                    />
                )}
            />
        );
    },
);

// ── Paragraph wrapper with TTS highlighting ──

interface TtsParagraphProps {
    paragraph: { paragraphIndex: number; content: string };
    documentId: string;
    search: SearchHighlightState | null;
    isActiveMatch?: boolean;
    highlights?: HighlightItem[];
    onPlayFromHere?: (paragraphIndex: number) => void;
    canSpeak?: boolean;
    incompatibleMessage?: string;
}

export function TtsParagraph({
    paragraph,
    documentId,
    search,
    isActiveMatch,
    highlights,
    onPlayFromHere,
    canSpeak,
    incompatibleMessage,
}: TtsParagraphProps) {
    const { t } = useTranslation();
    const ttsHighlight = useTtsHighlight(paragraph.paragraphIndex, documentId);

    const readFromHereLabel = t("Lire à partir d'ici");
    const tooltip = canSpeak
        ? readFromHereLabel
        : (incompatibleMessage ?? t('Aucune voix disponible pour cette langue.'));

    return (
        <SermonParagraphView
            paragraph={paragraph}
            search={search}
            isActiveMatch={isActiveMatch}
            highlights={highlights}
            ttsHighlight={ttsHighlight}
            playFromHereButton={
                onPlayFromHere ? (
                    <Tooltip title={tooltip}>
                        <span>
                            <button
                                className="tts-play-from-here"
                                disabled={!canSpeak}
                                onClick={(e) => {
                                    if (!canSpeak) return;
                                    e.stopPropagation();
                                    onPlayFromHere(paragraph.paragraphIndex);
                                }}
                                aria-label={
                                    canSpeak ? readFromHereLabel : t('Lecture audio indisponible')
                                }
                            >
                                <CaretRightOutlined />
                            </button>
                        </span>
                    </Tooltip>
                ) : undefined
            }
        />
    );
}
