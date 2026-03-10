import { Button, Tooltip } from 'antd';
import { PauseCircleOutlined, SoundOutlined } from '@ant-design/icons';
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
}

// ── TTS play/pause button ──

const ttsActiveStyle = {
    color: 'var(--ant-color-primary)',
    backgroundColor: 'var(--ant-color-primary-bg)',
};

export function TtsButton({ tts }: { tts: TtsControls }) {
    if (!tts.canSpeak) return null;

    const label = tts.isPlaying
        ? 'Pause lecture'
        : tts.isPaused
          ? 'Reprendre la lecture'
          : 'Lecture audio';

    const handler = tts.isPlaying ? tts.pause : tts.isPaused ? tts.resume : tts.play;
    const isActive = tts.isPlaying || tts.isPaused;

    return (
        <Tooltip title={label}>
            <Button
                type="text"
                size="small"
                icon={tts.isPlaying ? <PauseCircleOutlined /> : <SoundOutlined />}
                onClick={handler}
                aria-label="Lecture audio TTS"
                style={isActive ? ttsActiveStyle : undefined}
            />
        </Tooltip>
    );
}

// ── Paragraph wrapper with TTS highlighting ──

interface TtsParagraphProps {
    paragraph: { paragraphIndex: number; content: string };
    search: { term: string; mode: SearchMode } | null;
    currentMatchIndex: number;
    matchOffset: number;
    highlights?: HighlightItem[];
}

export function TtsParagraph({
    paragraph,
    search,
    currentMatchIndex,
    matchOffset,
    highlights,
}: TtsParagraphProps) {
    const ttsHighlight = useTtsHighlight(paragraph.paragraphIndex);
    return (
        <SermonParagraphView
            paragraph={paragraph}
            search={search}
            currentMatchIndex={currentMatchIndex}
            matchOffset={matchOffset}
            highlights={highlights}
            ttsHighlight={ttsHighlight}
        />
    );
}
