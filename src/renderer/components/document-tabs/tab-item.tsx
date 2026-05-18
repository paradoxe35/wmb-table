import { memo } from 'react';
import { Reorder } from 'framer-motion';
import { FileOutlined, SnippetsOutlined, SoundOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import type { DocumentTab, SermonListItemWithTranslations } from '@shared/types';
import { getDocumentIdentityFromTab, getDocumentIdentityKey } from '@shared/types';
import { formatShortDate } from '@renderer/utils/sermon-utils';
import { useTtsStore } from '@renderer/stores/tts.store';
import { useAudioStore, useSermonsById } from '@renderer/stores';
import { BibleIcons } from '../icons';

const SpeakerSvg = () => (
    <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor">
        <path d="M625.9 115c-5.9 0-11.9 1.6-17.4 5.3L254 352H90c-8.8 0-16 7.2-16 16v288c0 8.8 7.2 16 16 16h164l354.5 231.7c5.5 3.6 11.6 5.3 17.4 5.3 16.7 0 32.1-13.3 32.1-32.1V147.1c0-18.8-15.4-32.1-32.1-32.1z" />
    </svg>
);

const SpeakerIcon = (props: Record<string, unknown>) => <Icon component={SpeakerSvg} {...props} />;

function getTabIcon(tab: DocumentTab) {
    if (tab.type === 'bible') return <BibleIcons />;
    if (tab.type === 'custom') return <SnippetsOutlined style={{ fontSize: 'var(--fs-base)' }} />;
    return <FileOutlined style={{ fontSize: 'var(--fs-base)' }} />;
}

function useTabAudioState(tab: DocumentTab) {
    const tabDocumentKey = getDocumentIdentityKey(getDocumentIdentityFromTab(tab));
    const { ttsPlaying, ttsPaused } = useTtsStore((s) => {
        const isCurrentTtsTab = s.documentKey === tabDocumentKey;

        return {
            ttsPlaying: isCurrentTtsTab && (s.status === 'playing' || s.status === 'loading'),
            ttsPaused: isCurrentTtsTab && s.status === 'paused',
        };
    });
    const { audioPlaying, audioPaused } = useAudioStore((s) => {
        const isCurrentAudioTab =
            tab.type === 'sermon' &&
            s.sermonId === tab.documentId &&
            s.translationId === tab.translationId &&
            s.languageCode === tab.languageCode;

        return {
            audioPlaying: isCurrentAudioTab && s.currentPlay?.status === 'play',
            audioPaused: isCurrentAudioTab && s.currentPlay?.status === 'pause',
        };
    });

    const isPlaying = ttsPlaying || audioPlaying;
    const isPaused = !isPlaying && (ttsPaused || audioPaused);
    const isTts = ttsPlaying || ttsPaused;

    return { isPlaying, isPaused, isTts };
}

function getSermonTranslationName(
    tab: DocumentTab,
    sermonsById: Record<string, SermonListItemWithTranslations>,
): string | null {
    if (tab.type !== 'sermon') {
        return null;
    }

    const sermon = sermonsById[tab.documentId];
    const translation = sermon?.availableTranslations.find(
        (item) =>
            item.translationId === tab.translationId && item.languageCode === tab.languageCode,
    );

    return translation?.translationName?.trim() || null;
}

function getTabLabel(
    tab: DocumentTab,
    sermonsById: Record<string, SermonListItemWithTranslations>,
) {
    if (tab.type !== 'sermon') {
        return tab.title;
    }

    const translationName = getSermonTranslationName(tab, sermonsById);
    const translationLabel = translationName ? ` (${translationName})` : '';

    return `${tab.title}${translationLabel} - ${formatShortDate(tab.documentId)}`;
}

function getTabTooltip(
    tab: DocumentTab,
    sermonsById: Record<string, SermonListItemWithTranslations>,
) {
    if (tab.type !== 'sermon') {
        return tab.title;
    }
    return getTabLabel(tab, sermonsById);
}

function TabItem({
    tab,
    isActive,
    onActivate,
    onRemove,
    contextMenuItems,
}: {
    tab: DocumentTab;
    isActive: boolean;
    onActivate: () => void;
    onRemove: () => void;
    contextMenuItems: MenuProps['items'];
}) {
    const { isPlaying, isPaused, isTts } = useTabAudioState(tab);
    const sermonsById = useSermonsById();
    const tabTooltip = getTabTooltip(tab, sermonsById);
    const tabLabel = getTabLabel(tab, sermonsById);

    return (
        <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
            <Reorder.Item
                value={tab}
                as="div"
                className="chrome-tab"
                data-active={isActive}
                initial={false}
                onClick={onActivate}
                title={tabTooltip}
                onMouseDown={(e) => {
                    if (e.button === 1) {
                        e.preventDefault();
                        onRemove();
                    }
                }}
            >
                <div className="chrome-tab-dividers" />
                <div className="chrome-tab-background">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <symbol id="chrome-tab-geometry-left" viewBox="0 0 214 36">
                                <path d="M17 0h197v36H0v-2c4.5 0 9-3.5 9-8V8c0-4.5 3.5-8 8-8z" />
                            </symbol>
                            <symbol id="chrome-tab-geometry-right" viewBox="0 0 214 36">
                                <use xlinkHref="#chrome-tab-geometry-left" />
                            </symbol>
                            <clipPath id="crop">
                                <rect className="mask" width="100%" height="100%" x="0" />
                            </clipPath>
                        </defs>
                        <svg width="52%" height="100%">
                            <use
                                xlinkHref="#chrome-tab-geometry-left"
                                width="214"
                                height="36"
                                className="chrome-tab-geometry"
                            />
                        </svg>
                        <g transform="scale(-1, 1)">
                            <svg width="52%" height="100%" x="-100%" y="0">
                                <use
                                    xlinkHref="#chrome-tab-geometry-right"
                                    width="214"
                                    height="36"
                                    className="chrome-tab-geometry"
                                />
                            </svg>
                        </g>
                    </svg>
                </div>
                <div className="chrome-tab-content">
                    <div className="chrome-tab-favicon">
                        {isPlaying ? (
                            <SoundOutlined
                                style={{
                                    fontSize: 'var(--fs-base)',
                                    color: isTts
                                        ? 'var(--ant-color-warning)'
                                        : 'var(--ant-color-primary)',
                                }}
                            />
                        ) : isPaused ? (
                            <SpeakerIcon style={{ fontSize: 'var(--fs-base)' }} />
                        ) : (
                            getTabIcon(tab)
                        )}
                    </div>
                    <div className="chrome-tab-title" title={tabTooltip}>
                        {tabLabel}
                    </div>
                    <div className="chrome-tab-drag-handle" />
                    <div
                        className="chrome-tab-close"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                    />
                </div>
            </Reorder.Item>
        </Dropdown>
    );
}

export default memo(TabItem);
