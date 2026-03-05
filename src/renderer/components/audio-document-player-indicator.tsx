import { Button } from 'antd';
import { useCallback, useEffect, useRef } from 'react';
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useAudioStore } from '@renderer/stores';
import { AUDIO_PLAYER } from '@renderer/utils/events';

export default function AudioDocumentPlayerIndicator() {
    const currentAudioDocumentPlay = useAudioStore((s) => s.currentPlay);

    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const timeInterval = useRef<number | null>(null);

    const toggleWaveEffectButton = useCallback(() => {
        buttonRef.current?.setAttribute('ant-click-animating-without-extra-node', 'true');
        const timeout = window.setTimeout(() => {
            buttonRef.current?.setAttribute('ant-click-animating-without-extra-node', 'false');
            clearTimeout(timeout);
        }, 2000);
    }, []);

    useEffect(() => {
        if (timeInterval.current) clearInterval(timeInterval.current);
        if (currentAudioDocumentPlay?.status === 'play') {
            timeInterval.current = window.setInterval(toggleWaveEffectButton, 3000);
        }
    }, [currentAudioDocumentPlay, toggleWaveEffectButton]);

    const openPlayer = useCallback(() => {
        window.dispatchEvent(new Event(AUDIO_PLAYER.openModalPlayer));
    }, []);

    return (
        currentAudioDocumentPlay && (
            <Button
                ref={buttonRef}
                onClick={openPlayer}
                style={{ alignSelf: 'center' }}
                type={currentAudioDocumentPlay.status === 'play' ? 'primary' : 'default'}
                shape="circle"
                ghost={currentAudioDocumentPlay.status === 'play'}
                icon={
                    currentAudioDocumentPlay.status === 'play' ? (
                        <PauseCircleOutlined />
                    ) : (
                        <PlayCircleOutlined />
                    )
                }
                size="large"
            />
        )
    );
}
