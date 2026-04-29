import { Button } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useAudioStore } from '@renderer/stores';

export default function AudioDocumentPlayerIndicator() {
    const currentPlay = useAudioStore((s) => s.currentPlay);
    const openModal = useAudioStore((s) => s.openModal);

    if (!currentPlay) return null;

    const isPlaying = currentPlay.status === 'play';

    return (
        <Button
            onClick={openModal}
            className={isPlaying ? 'audio-indicator--pulsing' : undefined}
            style={{ alignSelf: 'center', marginBottom: '6px' }}
            type={isPlaying ? 'primary' : 'default'}
            shape="circle"
            ghost={isPlaying}
            icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            size="medium"
        />
    );
}
