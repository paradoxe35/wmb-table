import { useEffect, useRef } from 'react';
import { Button, Tooltip } from 'antd';
import {
    PauseOutlined,
    SoundOutlined,
    CaretRightOutlined,
    ZoomInOutlined,
    ZoomOutOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { HighlightItem } from '@shared/types';
import type { SearchHighlightState } from './hooks';
import SermonParagraphView from './sermon-paragraph';
import { useTtsHighlight } from '@renderer/hooks/use-tts-highlight';
import { useTtsStore } from '@renderer/stores/tts.store';

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
        // Show a disabled button so the user knows TTS exists but isn't available
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

// ── Paragraph list ──

interface ParagraphListProps {
    paragraphs: { paragraphIndex: number; content: string }[];
    documentId: string;
    search: SearchHighlightState | null;
    activeParagraphIndex: number;
    highlightsByParagraph: Map<number, HighlightItem[]>;
    onPlayFromHere?: (paragraphIndex: number) => void;
    canSpeak?: boolean;
    incompatibleMessage?: string;
}

export function ParagraphList({
    paragraphs,
    documentId,
    search,
    activeParagraphIndex,
    highlightsByParagraph,
    onPlayFromHere,
    canSpeak,
    incompatibleMessage,
}: ParagraphListProps) {
    return (
        <>
            {paragraphs.map((p) => (
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
            ))}
        </>
    );
}

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
    const autoScroll = useTtsStore((s) => s.settings?.autoScrollToHighlight ?? true);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ttsHighlight.isActive && autoScroll) {
            containerRef.current?.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
    }, [ttsHighlight.isActive, autoScroll]);

    const readFromHereLabel = t("Lire à partir d'ici");
    const tooltip = canSpeak
        ? readFromHereLabel
        : (incompatibleMessage ?? t('Aucune voix disponible pour cette langue.'));

    return (
        <div ref={containerRef}>
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
                                        canSpeak
                                            ? readFromHereLabel
                                            : t('Lecture audio indisponible')
                                    }
                                >
                                    <CaretRightOutlined />
                                </button>
                            </span>
                        </Tooltip>
                    ) : undefined
                }
            />
        </div>
    );
}
