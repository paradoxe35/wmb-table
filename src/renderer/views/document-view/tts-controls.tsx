import { memo, useEffect, useMemo, useRef } from 'react';
import { Button, Tooltip } from 'antd';
import { PauseOutlined, SoundOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { DocumentIdentity, HighlightItem } from '@shared/types';
import type { SearchHighlightState } from './hooks';
import SermonParagraphView from './sermon-paragraph';
import { useTtsHighlight } from '@renderer/hooks/use-tts-highlight';
import { useTtsStore } from '@renderer/stores/tts.store';
import { useAppStore, useDocumentTabsStore } from '@renderer/stores';
import { getPendingNavigationParagraphIndex } from '@renderer/utils/pending-navigation';
import { DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import {
    type FollowReason,
    decideFollow,
    measureFollowGeometry,
    spokenOnScreen,
    planFollowScroll,
    prefersReducedMotion,
} from './follow-reading';
import {
    followPause,
    isJumpMoving,
    msSinceUserScroll,
    resumeFollowing,
} from '@renderer/utils/user-scroll';

// ── Shared TTS controls interface ──

export interface TtsControls {
    canSpeak: boolean;
    incompatibleMessage?: string;
    isPlaying: boolean;
    isPaused: boolean;
    canResume: boolean;
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

    const canResume = tts.isPaused || tts.canResume;

    const label = tts.isPlaying
        ? t('Pause voix')
        : canResume
          ? t('Reprendre la voix')
          : t('Lire à voix haute');

    const handler = tts.isPlaying ? tts.pause : tts.isPaused ? tts.resume : tts.play;
    const isActive = tts.isPlaying || canResume;

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
    documentKey: string;
    documentIdentity: DocumentIdentity | null;
    search: SearchHighlightState | null;
    activeParagraphIndex: number;
    highlightsByParagraph: Map<number, HighlightItem[]>;
}

export const ParagraphList = memo(function ParagraphList({
    paragraphs,
    documentKey,
    documentIdentity,
    search,
    activeParagraphIndex,
    highlightsByParagraph,
}: ParagraphListProps) {
    const pendingNavigation = useDocumentTabsStore((s) => s.pendingNavigation);
    const pendingNavigationParagraphIndex = getPendingNavigationParagraphIndex(
        pendingNavigation,
        documentIdentity,
    );

    const renderedParagraphs = useMemo(
        () =>
            paragraphs.map((paragraph) => (
                <TtsParagraph
                    key={paragraph.paragraphIndex}
                    paragraph={paragraph}
                    documentKey={documentKey}
                    search={search}
                    isActiveMatch={paragraph.paragraphIndex === activeParagraphIndex}
                    highlights={highlightsByParagraph.get(paragraph.paragraphIndex)}
                    suppressAutoScroll={pendingNavigationParagraphIndex != null}
                />
            )),
        [
            paragraphs,
            documentKey,
            search,
            activeParagraphIndex,
            highlightsByParagraph,
            pendingNavigationParagraphIndex,
        ],
    );

    return <>{renderedParagraphs}</>;
});

// ── Paragraph wrapper with TTS highlighting ──

interface TtsParagraphProps {
    paragraph: { paragraphIndex: number; content: string };
    documentKey: string;
    search: SearchHighlightState | null;
    isActiveMatch?: boolean;
    highlights?: HighlightItem[];
    suppressAutoScroll?: boolean;
}

const TtsParagraph = memo(function TtsParagraph({
    paragraph,
    documentKey,
    search,
    isActiveMatch,
    highlights,
    suppressAutoScroll,
}: TtsParagraphProps) {
    const ttsHighlight = useTtsHighlight(paragraph.paragraphIndex, documentKey);
    const autoScroll = useTtsStore((s) => s.settings?.autoScrollToHighlight ?? true);
    const mainView = useAppStore((s) => s.mainView);
    const containerRef = useRef<HTMLDivElement>(null);
    const previousActiveRef = useRef(false);
    const previousAutoScrollRef = useRef(autoScroll);
    const previousMainViewRef = useRef(mainView);
    const range = ttsHighlight.highlightRange;
    const segmentKey = range ? `${range.start}:${range.end}` : '';
    const spokenRef = useRef(range);
    spokenRef.current = range;
    const previousSegmentKeyRef = useRef(segmentKey);

    useEffect(() => {
        const becameActive = ttsHighlight.isActive && !previousActiveRef.current;
        const segmentMoved =
            ttsHighlight.isActive &&
            previousActiveRef.current &&
            segmentKey !== previousSegmentKeyRef.current;
        const autoScrollEnabled = autoScroll && !previousAutoScrollRef.current;
        const enteredDocumentView =
            mainView === 'document' && previousMainViewRef.current !== 'document';

        previousActiveRef.current = ttsHighlight.isActive;
        previousSegmentKeyRef.current = segmentKey;
        previousAutoScrollRef.current = autoScroll;
        previousMainViewRef.current = mainView;

        if (
            !ttsHighlight.isActive ||
            !autoScroll ||
            mainView !== 'document' ||
            suppressAutoScroll
        ) {
            return;
        }

        const explicit = autoScrollEnabled || enteredDocumentView;
        if (!becameActive && !segmentMoved && !explicit) {
            return;
        }
        const reason: FollowReason = becameActive || explicit ? 'paragraph' : 'segment';

        let frameId = 0;
        let retryId: ReturnType<typeof setTimeout> | undefined;
        const follow = () => {
            const paragraphElement = containerRef.current;
            const scroller = paragraphElement?.closest<HTMLElement>(`#${DOCUMENT_CONTAINER_ID}`);
            if (!paragraphElement || !scroller) return;
            const geometry = measureFollowGeometry(scroller, paragraphElement, spokenRef.current);
            const decision = decideFollow({
                pause: followPause(scroller),
                msSinceScroll: msSinceUserScroll(scroller),
                reason,
                explicit,
                onScreen: spokenOnScreen(geometry),
                locked: scroller.dataset.scrollLocked === 'true',
                jumpMoving: isJumpMoving(scroller),
            });
            if (!decision.follow) {
                // Nothing else may come for a single-sentence paragraph, so try again later
                if (decision.retryInMs != null) {
                    retryId = setTimeout(() => {
                        frameId = requestAnimationFrame(follow);
                    }, decision.retryInMs + 50);
                }
                return;
            }
            if (decision.resume) resumeFollowing(scroller);

            const delta = planFollowScroll(geometry, reason);
            if (delta == null) return;

            const viewportHeight = geometry.viewport.bottom - geometry.viewport.top;
            const smooth =
                reason === 'segment' &&
                Math.abs(delta) <= viewportHeight &&
                !prefersReducedMotion();
            scroller.scrollBy({ top: delta, behavior: smooth ? 'smooth' : 'instant' });
        };

        // When returning from options, the document panel was display:none.
        // Wait for it to be visible and laid out again before measuring.
        frameId = requestAnimationFrame(follow);
        return () => {
            cancelAnimationFrame(frameId);
            clearTimeout(retryId);
        };
    }, [ttsHighlight.isActive, segmentKey, autoScroll, mainView, suppressAutoScroll]);

    return (
        <div ref={containerRef}>
            <SermonParagraphView
                paragraph={paragraph}
                search={search}
                isActiveMatch={isActiveMatch}
                highlights={highlights}
                ttsHighlight={ttsHighlight}
            />
        </div>
    );
});
