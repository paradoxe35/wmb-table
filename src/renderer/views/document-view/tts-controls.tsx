import { Button, Tooltip } from 'antd';
import {
    PauseCircleOutlined,
    SoundOutlined,
    CaretRightOutlined,
    ZoomInOutlined,
    ZoomOutOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { SearchMode, HighlightItem } from '@shared/types';
import SermonParagraphView from './sermon-paragraph';
import { useTtsHighlight } from '@renderer/hooks/use-tts-highlight';

// ── Shared TTS controls interface ──

export interface TtsControls {
    canSpeak: boolean;
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
    color: 'var(--ant-color-primary)',
    backgroundColor: 'var(--ant-color-primary-bg)',
};

export function TtsButton({ tts }: { tts: TtsControls }) {
    const { t } = useTranslation();
    if (!tts.canSpeak) return null;

    const label = tts.isPlaying
        ? t('Pause lecture')
        : tts.isPaused
          ? t('Reprendre la lecture')
          : t('Démarrer la lecture');

    const handler = tts.isPlaying ? tts.pause : tts.isPaused ? tts.resume : tts.play;
    const isActive = tts.isPlaying || tts.isPaused;

    return (
        <Tooltip title={label}>
            <Button
                type="text"
                size="small"
                icon={tts.isPlaying ? <PauseCircleOutlined /> : <SoundOutlined />}
                onClick={handler}
                aria-label={t('Lecture audio TTS')}
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
            <span style={{ fontSize: '0.8em', minWidth: 50, textAlign: 'center' }}>{zoom}%</span>
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
    search: { term: string; mode: SearchMode } | null;
    currentMatchIndex: number;
    matchOffsets: number[];
    highlightsByParagraph: Map<number, HighlightItem[]>;
    onPlayFromHere?: (paragraphIndex: number) => void;
    canSpeak?: boolean;
}

export function ParagraphList({
    paragraphs,
    documentId,
    search,
    currentMatchIndex,
    matchOffsets,
    highlightsByParagraph,
    onPlayFromHere,
    canSpeak,
}: ParagraphListProps) {
    return (
        <>
            {paragraphs.map((p, i) => (
                <TtsParagraph
                    key={p.paragraphIndex}
                    paragraph={p}
                    documentId={documentId}
                    search={search}
                    currentMatchIndex={currentMatchIndex}
                    matchOffset={matchOffsets[i] ?? 0}
                    highlights={highlightsByParagraph.get(p.paragraphIndex)}
                    onPlayFromHere={onPlayFromHere}
                    canSpeak={canSpeak}
                />
            ))}
        </>
    );
}

// ── Paragraph wrapper with TTS highlighting ──

interface TtsParagraphProps {
    paragraph: { paragraphIndex: number; content: string };
    documentId: string;
    search: { term: string; mode: SearchMode } | null;
    currentMatchIndex: number;
    matchOffset: number;
    highlights?: HighlightItem[];
    onPlayFromHere?: (paragraphIndex: number) => void;
    canSpeak?: boolean;
}

export function TtsParagraph({
    paragraph,
    documentId,
    search,
    currentMatchIndex,
    matchOffset,
    highlights,
    onPlayFromHere,
    canSpeak,
}: TtsParagraphProps) {
    const { t } = useTranslation();
    const ttsHighlight = useTtsHighlight(paragraph.paragraphIndex, documentId);
    return (
        <SermonParagraphView
            paragraph={paragraph}
            search={search}
            currentMatchIndex={currentMatchIndex}
            matchOffset={matchOffset}
            highlights={highlights}
            ttsHighlight={ttsHighlight}
            playFromHereButton={
                onPlayFromHere && canSpeak ? (
                    <Tooltip title={t("Lire à partir d'ici")}>
                        <button
                            className="tts-play-from-here"
                            onClick={(e) => {
                                e.stopPropagation();
                                onPlayFromHere(paragraph.paragraphIndex);
                            }}
                            aria-label={t("Lire à partir d'ici")}
                        >
                            <CaretRightOutlined />
                        </button>
                    </Tooltip>
                ) : undefined
            }
        />
    );
}
