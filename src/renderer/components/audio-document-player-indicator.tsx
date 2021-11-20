import { Button } from 'antd';
import React, { useCallback, useEffect, useRef } from 'react';
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useRecoilValue } from 'recoil';
import { currentAudioDocumentPlayStore } from '@renderer/store';
import { AUDIO_PLAYER } from '@modules/shared/shared';

export default function AudioDocumentPlayerIndicator() {
  const currentAudioDocumentPlay = useRecoilValue(
    currentAudioDocumentPlayStore
  );

  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const timeInterval = useRef<null | number>(null);

  const toogleWaveEffectButton = useCallback(() => {
    buttonRef.current?.setAttribute(
      'ant-click-animating-without-extra-node',
      'true'
    );

    const timeout = window.setTimeout(() => {
      buttonRef.current?.setAttribute(
        'ant-click-animating-without-extra-node',
        'false'
      );
      clearTimeout(timeout);
    }, 2000);
  }, []);

  useEffect(() => {
    timeInterval.current && clearInterval(timeInterval.current);

    if (currentAudioDocumentPlay?.status === 'play') {
      timeInterval.current = window.setInterval(toogleWaveEffectButton, 3000);
    }
  }, [currentAudioDocumentPlay]);

  const openPlayer = useCallback(() => {
    window.dispatchEvent(new Event(AUDIO_PLAYER.openModalPlayer));
  }, []);

  return (
    currentAudioDocumentPlay && (
      <Button
        ref={buttonRef}
        onClick={openPlayer}
        style={{ alignSelf: 'center' }}
        type={
          currentAudioDocumentPlay.status === 'play' ? 'primary' : 'default'
        }
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
