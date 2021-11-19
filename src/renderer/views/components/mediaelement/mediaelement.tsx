import { useCallbackUpdater } from '@renderer/hooks';
import React, { useEffect, useRef } from 'react';
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
  audioSrc: string;
  onTimeUpdate?: (time: number) => void;
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
  subtitle: { text, head },
  onTimeUpdate,
  onPause,
  onPlay,
  getPlayerRef,
}: MediaElementProps) {
  const onTimeUpdateRef = useCallbackUpdater(onTimeUpdate);
  const onPlayRef = useCallbackUpdater(onPlay);
  const onPauseRef = useCallbackUpdater(onPause);
  const onGetPlayerRefRef = useCallbackUpdater(getPlayerRef);

  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const palyerRef = useRef<any>(undefined);

  useEffect(() => {
    if (palyerRef.current) {
      palyerRef.current.load();
      palyerRef.current.play();
    }
  }, [audioSrc]);

  useEffect(() => {
    if (!audioElRef.current) return;

    const options = {
      defaultSpeed: '1.00',
      speeds: ['1.25', '1.50', '2.00', '0.75'],
      loop: false,
      startVolume: 0.2,
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

    const palyer = new MediaElementPlayer(audioElRef.current, options);

    palyerRef.current = palyer;

    onGetPlayerRefRef(palyer);

    palyer.node.addEventListener('timeupdate', () =>
      onTimeUpdateRef(palyer.getCurrentTime())
    );

    palyer.node.addEventListener('play', onPlayRef);

    palyer.node.addEventListener('pause', onPauseRef);

    // Separate the audio controls so I can style them better.
    controllersSeparator();
  }, []);

  return (
    <>
      <div className="podcast">
        <h3 className="podcast__episode_title">{title}</h3>
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
