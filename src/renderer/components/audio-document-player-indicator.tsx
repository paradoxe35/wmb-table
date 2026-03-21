import { Button } from 'antd';
import { useCallback, useEffect, useRef } from 'react';
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useAudioStore } from '@renderer/stores';

export default function AudioDocumentPlayerIndicator() {
    const currentPlay = useAudioStore((s) => s.currentPlay);
    const openModal = useAudioStore((s) => s.openModal);

    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const timeInterval = useRef<null | number>(null);

    const toggleWaveEffectButton = useCallback(() => {
        buttonRef.current?.setAttribute('ant-click-animating-without-extra-node', 'true');

        const timeout = window.setTimeout(() => {
            buttonRef.current?.setAttribute('ant-click-animating-without-extra-node', 'false');
            clearTimeout(timeout);
        }, 2000);
    }, []);

    useEffect(() => {
        if (timeInterval.current) clearInterval(timeInterval.current);

        if (currentPlay?.status === 'play') {
            timeInterval.current = window.setInterval(toggleWaveEffectButton, 3000);
        }
    }, [currentPlay, toggleWaveEffectButton]);

    if (!currentPlay) return null;

    return (
        <Button
            ref={buttonRef}
            onClick={openModal}
            style={{ alignSelf: 'center', marginBottom: '6px' }}
            type={currentPlay.status === 'play' ? 'primary' : 'default'}
            shape="circle"
            ghost={currentPlay.status === 'play'}
            icon={currentPlay.status === 'play' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            size="medium"
        />
    );
}
