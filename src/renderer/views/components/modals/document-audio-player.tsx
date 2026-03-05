import { AUDIO_PLAYER, CHILD_PARENT_WINDOW_EVENT } from '@renderer/utils/events';
import { useDocumentViewOpen } from '@renderer/components/viewer/document-viewer';
import { useModalVisible, useValueStateRef } from '@renderer/hooks';
import { throttle } from '@renderer/utils/functions';
import { Modal } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import MediaElement from '../mediaelement/mediaelement';
import { useAudioStore } from '@renderer/stores';

interface AudioTitle {
    title: string;
    audio_link?: string;
    traduction?: string;
}

export default function DocumentAudioPlayer() {
    const { visible, hide, setVisible } = useModalVisible();

    const [docTitle, setDocTitle] = useState<
        (AudioTitle & { audioTime?: number; origin_audio_link: string }) | null
    >(null);

    const docTitleRef = useValueStateRef(docTitle);

    const setCurrentPlay = useAudioStore((s) => s.setCurrentPlay);

    const audioPlayerRef = useRef<any>(null);

    const autoplay = useRef(true);

    const viewDocument = useDocumentViewOpen();

    useEffect(() => {
        const handleAudioPlay = async (event: CustomEventInit<AudioTitle>) => {
            if (!event.detail?.audio_link) return;
            // first check if the request is not the current player session
            if (docTitleRef.current?.title === event.detail?.title) {
                // for last audio player was found, then open modal first only first time on play
                if (!autoplay.current) {
                    setVisible(true);
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

            // if different from the last audio player the reset autoplay variable to true
            if (docTitleRef.current?.title && docTitleRef.current?.title !== event.detail?.title) {
                autoplay.current = true;
            }

            // register last player
            window.api.audio.setLastPlay(event.detail.title);

            // request for last played time and local file path if available
            const { time, local_file } = await window.api.audio.getTimeAndLocalFile(
                event.detail.audio_link!,
            );
            const ctime = typeof time === 'number' ? time : undefined;

            // update audio document state
            setDocTitle({
                ...event.detail!,
                audioTime: ctime,
                origin_audio_link: event.detail?.audio_link ?? '',
                audio_link: local_file?.replaceAll('#', '%23') || event.detail?.audio_link,
            });

            // open modal if not yet and auto is set to true
            if (autoplay.current) {
                setVisible(true);
            }

            // set as current audio play
            setCurrentPlay({
                documentTitle: event.detail?.title ?? '',
                status: autoplay.current ? 'play' : 'pause',
            });
        };

        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.audioDocumentPlay, handleAudioPlay);
        return () => {
            window.removeEventListener(
                CHILD_PARENT_WINDOW_EVENT.audioDocumentPlay,
                handleAudioPlay,
            );
        };
    }, []);

    // initialize default data
    useEffect(() => {
        // listen to event from player icon
        window.addEventListener(AUDIO_PLAYER.openModalPlayer, () => {
            setVisible(true);
        });

        // get the last played audio document
        window.api.audio.getLastPlay().then((data) => {
            if (data) {
                // prevent audio to play is available at mount of component
                autoplay.current = false;
                // dispatch audio event
                window.dispatchEvent(
                    new CustomEvent(CHILD_PARENT_WINDOW_EVENT.audioDocumentPlay, {
                        detail: data,
                    }),
                );
            }
        });
    }, []);

    const onAudioPlay = useCallback(() => {
        setCurrentPlay({
            documentTitle: docTitleRef.current?.title ?? '',
            status: 'play',
        });
    }, []);

    const onAudioPause = useCallback(() => {
        setCurrentPlay({
            documentTitle: docTitleRef.current?.title ?? '',
            status: 'pause',
        });
    }, []);

    const onAudioTimeUpdate = useCallback((time: number) => {
        window.api.audio.setTime(docTitleRef.current?.origin_audio_link || '', time);
    }, []);

    const setAudioPlayRef = useCallback((player: any) => {
        audioPlayerRef.current = player;
    }, []);

    const handleOnTitleClick = useCallback(() => {
        if (docTitleRef.current?.title) {
            viewDocument(docTitleRef.current?.title);
            setVisible(false);
        }
    }, [docTitle, viewDocument]);

    return (
        <>
            <Modal
                title={null}
                footer={[]}
                width={600}
                forceRender
                open={visible}
                onOk={hide}
                onCancel={hide}
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
                            head: 'Langue',
                            text: docTitle.traduction ?? '',
                        }}
                    />
                )}
            </Modal>
        </>
    );
}
