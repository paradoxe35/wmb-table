import { useCallbackUpdater, useValueStateRef } from '@renderer/hooks';
import React, { useCallback, useEffect, useRef } from 'react';
import './lib/index';
import svg from './lib/svg/vocal_103008.svg';

declare var MediaElementPlayer: any;

const controllersSeparator = () => {
  const elementTop = document.createElement('div');
  const elementBottom = document.createElement('div');
  elementTop.classList.add('mejs-prepended-buttons');
  elementBottom.classList.add('mejs-appended-buttons');

  const controls = document.querySelector('.mejs__controls');
  controls?.prepend(elementTop);
  controls?.append(elementBottom);

  const controlsChildren = Array.from(
    controls?.childNodes || []
    //@ts-ignore
  ).filter((v) => v.className.startsWith('mejs_'));

  controlsChildren.slice(0, 3).forEach((elem) => {
    elementTop.append(elem);
  });

  controlsChildren.slice(3, controlsChildren.length).forEach((elem) => {
    elementBottom.append(elem);
  });

  // organize volume slider
  const volumeContainer = document.createElement('div');
  volumeContainer.className = 'mejs__volume-controller';
  const volumeButton = document.querySelector('.mejs__volume-button');

  volumeButton?.parentElement?.insertBefore(volumeContainer, volumeButton);
  const volumeSlider = document.querySelector(
    '.mejs__horizontal-volume-slider'
  );
  volumeContainer?.appendChild(volumeButton!);
  volumeContainer.appendChild(volumeSlider!);
};

type MediaElementProps = {
  title: string;
  autoPlay: boolean;
  key: React.Key | null | undefined;
  audioSrc: string;
  defaultTime?: number;
  onTimeUpdate?: (time: number) => void;
  onTitleClick?: (title: string) => void;
  onPlay?: () => void;
  onPause?: () => void;
  getPlayerRef?: (player: any) => void;
  subtitle: {
    head?: string;
    text?: string;
  };
};

export default function MediaElement({
  title,
  audioSrc,
  defaultTime,
  subtitle: { text, head },
  onTimeUpdate,
  onPause,
  autoPlay = true,
  onPlay,
  getPlayerRef,
  onTitleClick,
}: MediaElementProps) {
  const onTimeUpdateRef = useCallbackUpdater(onTimeUpdate);
  const onPlayRef = useCallbackUpdater(onPlay);
  const onPauseRef = useCallbackUpdater(onPause);
  const onGetPlayerRefRef = useCallbackUpdater(getPlayerRef);

  const defaultTimeRef = useValueStateRef(defaultTime);

  const audioElRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioElRef.current) return;

    const options = {
      defaultSpeed: '1.00',
      speeds: ['1.25', '1.50', '2.00', '0.75'],
      loop: false,
      startVolume: 0.5,
      skipBackInterval: 15,
      jumpForwardInterval: 15,
      features: [
        'playpause',
        'progress',
        'current',
        'duration',
        'skipback',
        'changespeed',
        'volume',
        'jumpforward',
      ],
    };

    const player = new MediaElementPlayer(audioElRef.current, options);

    player.load();
    player.setCurrentTime(defaultTimeRef.current || 0);
    if (autoPlay) {
      player.play();
    }

    onGetPlayerRefRef(player);

    player.node?.addEventListener('timeupdate', () =>
      onTimeUpdateRef(player.getCurrentTime())
    );

    player.node?.addEventListener('play', onPlayRef);

    player.node?.addEventListener('pause', onPauseRef);

    // Separate the audio controls so I can style them better.
    controllersSeparator();

    return () => {
      player.remove();
    };
  }, []);

  const handelTitleClick = useCallback(() => {
    onTitleClick && onTitleClick(title);
  }, [title]);

  return (
    <>
      <div className="podcast">
        <h3
          className={`podcast__episode_title ${
            onTitleClick ? 'clickable hover-underline' : ''
          }`}
          onClick={handelTitleClick}
        >
          {title}
        </h3>
        <h5 className="podcast__title">
          {head}
          <i>{text}</i>
        </h5>

        <div className="podcast__meta">
          <audio ref={audioElRef} controls style={{ width: '100%' }}>
            <source src={audioSrc} />
            Your browser does not support the audio tag.
          </audio>
          <a href="#" className="artwork">
            <img src={svg} alt="Vocal" />
          </a>
        </div>
      </div>
    </>
  );
}
