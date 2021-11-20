import { Title } from '@localtypes/index';
import { CHILD_PARENT_WINDOW_EVENT } from '@modules/shared/shared';
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
    (Title & { audioTime?: number }) | null
  >(null);

  const docTitleRef = useValueStateRef(docTitle);

  const setCurrentAudioDocumentPlay = useSetRecoilState(
    currentAudioDocumentPlayStore
  );

  const audioPlayerRef = useRef<any>(null);

  useEffect(() => {
    const handleAudioPlay = async (event: CustomEventInit<Title>) => {
      // first check if the request is not the current player session
      if (docTitleRef.current?.title === event.detail?.title) {
        // pause if is playing or play if pause
        if (audioPlayerRef.current?.paused === true) {
          audioPlayerRef.current?.play();
        } else {
          audioPlayerRef.current?.pause();
        }
        return;
      }

      sendIpcRequest<number | undefined>(
        IPC_EVENTS.audio_document_time,
        event.detail?.title
      ).then((time) => {
        const ctime = typeof time === 'number' ? time : undefined;

        // update audio document state
        setDocTitle({
          audioTime: ctime,
          ...event.detail!,
        });
        // open modal if not yet
        setIsModalVisible(true);

        // set as current audio play
        setCurrentAudioDocumentPlay({
          documentTitle: event.detail?.title!,
          status: 'play',
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
      IPC_EVENTS.audio_document_time_set,
      docTitleRef.current?.title,
      time
    );
  }, []);

  const setAudioPlayRef = useCallback((player) => {
    audioPlayerRef.current = player;
  }, []);

  return (
    <>
      <Modal
        title={null}
        footer={[]}
        width={600}
        visible={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        {docTitle && (
          <MediaElement
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
