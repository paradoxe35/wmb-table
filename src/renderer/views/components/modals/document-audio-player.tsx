import { Title } from '@localtypes/index';
import {
  AUDIO_PLAYER,
  CHILD_PARENT_WINDOW_EVENT,
} from '@modules/shared/shared';
import { useDocumentViewOpen } from '@renderer/components/viewer/document-viewer';
import { useModalVisible, useValueStateRef } from '@renderer/hooks';
import { currentAudioDocumentPlayStore } from '@renderer/store';
import sendIpcRequest from '@root/ipc/ipc-renderer';
import { TRADUCTIONS } from '@root/utils/constants';
import { throttle } from '@root/utils/functions';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import { Modal } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import MediaElement from '../mediaelement/mediaelement';

export default function DocumentAudioPlayer() {
  const {
    isModalVisible,
    handleOk,
    handleCancel,
    setIsModalVisible,
  } = useModalVisible();

  const [docTitle, setDocTitle] = useState<
    (Title & { audioTime?: number; origin_audio_link: string }) | null
  >(null);

  const docTitleRef = useValueStateRef(docTitle);

  const setCurrentAudioDocumentPlay = useSetRecoilState(
    currentAudioDocumentPlayStore
  );

  const audioPlayerRef = useRef<any>(null);

  const autoplay = useRef(true);

  const viewDocument = useDocumentViewOpen();

  useEffect(() => {
    const handleAudioPlay = async (event: CustomEventInit<Title>) => {
      if (!event.detail?.audio_link) return;
      // first check if the request is not the current player session
      if (docTitleRef.current?.title === event.detail?.title) {
        // for last audio player was found, then open modal first only first time on play
        if (!autoplay.current) {
          setIsModalVisible(true);
          autoplay.current = true;
        }
        // pause if is playing or play if pause
        if (audioPlayerRef.current?.paused === true) {
          audioPlayerRef.current?.play();
        } else {
          audioPlayerRef.current?.pause();
        }
        return;
      }

      // if different from the last audio player the reset autplay variable to true
      if (
        docTitleRef.current?.title &&
        docTitleRef.current?.title !== event.detail?.title
      ) {
        autoplay.current = true;
      }

      // register last player
      sendIpcRequest(IPC_EVENTS.audio_document_last_play, event.detail);

      // request for last played time and local file path if available
      sendIpcRequest<{ time: number | undefined; local_file?: string }>(
        IPC_EVENTS.audio_document_time_and_local_file,
        event.detail
      ).then(({ time, local_file }) => {
        const ctime = typeof time === 'number' ? time : undefined;

        // update audio document state
        setDocTitle({
          ...event.detail!,
          audioTime: ctime,
          origin_audio_link: event.detail?.audio_link!,
          audio_link:
            local_file?.replaceAll('#', '%23') || event.detail?.audio_link,
        });

        // open modal if not yet and auto is set to true
        if (autoplay.current) {
          setIsModalVisible(true);
        }

        // set as current audio play
        setCurrentAudioDocumentPlay({
          documentTitle: event.detail?.title!,
          status: autoplay.current ? 'play' : 'pause',
        });
      });
    };

    window.addEventListener(
      CHILD_PARENT_WINDOW_EVENT.audioDocumentPlay,
      handleAudioPlay
    );
    return () => {
      window.removeEventListener(
        CHILD_PARENT_WINDOW_EVENT.audioDocumentPlay,
        handleAudioPlay
      );
    };
  }, []);

  // initialase default data
  useEffect(() => {
    // list to event from player icon
    window.addEventListener(AUDIO_PLAYER.openModalPlayer, () => {
      setIsModalVisible(true);
    });

    // get the last played audio document
    sendIpcRequest<Title | null>(IPC_EVENTS.audio_document_last_play).then(
      (data) => {
        if (data) {
          // prevent audio to play is available at mount of component
          autoplay.current = false;
          // dispach audio event
          window.dispatchEvent(
            new CustomEvent(CHILD_PARENT_WINDOW_EVENT.audioDocumentPlay, {
              detail: data,
            })
          );
        }
      }
    );
  }, []);

  const onAudioPlay = useCallback(() => {
    setCurrentAudioDocumentPlay({
      documentTitle: docTitleRef.current?.title!,
      status: 'play',
    });
  }, []);

  const onAudioPause = useCallback(() => {
    setCurrentAudioDocumentPlay({
      documentTitle: docTitleRef.current?.title!,
      status: 'pause',
    });
  }, []);

  const onAudioTimeUpdate = useCallback((time: number) => {
    sendIpcRequest<number | undefined>(
      IPC_EVENTS.audio_document_time_and_local_file_set,
      docTitleRef.current?.origin_audio_link,
      time
    );
  }, []);

  const setAudioPlayRef = useCallback((player) => {
    audioPlayerRef.current = player;
  }, []);

  const handleOnTitleClick = useCallback(() => {
    if (docTitleRef.current?.title) {
      viewDocument(docTitleRef.current?.title);
      setIsModalVisible(false);
    }
  }, [docTitle, viewDocument]);

  return (
    <>
      <Modal
        title={null}
        footer={[]}
        width={600}
        forceRender
        visible={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        {docTitle && (
          <MediaElement
            key={docTitle.audio_link!}
            autoPlay={autoplay.current}
            onTitleClick={handleOnTitleClick}
            title={docTitle.title}
            getPlayerRef={setAudioPlayRef}
            audioSrc={docTitle.audio_link!}
            defaultTime={docTitle.audioTime}
            onPlay={onAudioPlay}
            onTimeUpdate={throttle(onAudioTimeUpdate, 5000)}
            onPause={onAudioPause}
            subtitle={{
              head: 'Traduction',
              text: TRADUCTIONS[docTitle.traduction!],
            }}
          />
        )}
      </Modal>
    </>
  );
}
