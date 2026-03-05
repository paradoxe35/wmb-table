import { Title } from '@shared/types';
import { CHILD_PARENT_WINDOW_EVENT } from '@renderer/utils/events';
import { useCallback, useEffect, useRef, useState } from 'react';
import { message, notification, Progress } from 'antd';

const DownloadProgressStatus = () => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const cleanup = window.api.on.downloadDocumentPdfProgress((progres) => {
            if (typeof progres === 'number') {
                setProgress(+progres.toFixed(0));
            }
        });
        return cleanup;
    }, []);

    return (
        <Progress
            strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
            }}
            status="active"
            percent={progress}
        />
    );
};

export default function PdfDocumentDownloader() {
    const documentRef = useRef<Title | undefined>(undefined);
    const downloading = useRef<boolean>(false);

    // open notification about download progress
    const openNotification = useCallback(() => {
        notification.open({
            key: documentRef.current?.title,
            message: 'T\u00e9l\u00e9chargement en cours',
            description: <DownloadProgressStatus />,
            duration: 0,
        });
    }, []);

    // download handler after event has been emitted
    const downloadHandler = useCallback((event: CustomEventInit<Title>) => {
        // prevent start two download process
        if (downloading.current) return;

        // send download event to main thread
        documentRef.current = event.detail;
        window.api.app.downloadDocumentPdf(event.detail!.title).then((res) => {
            if (res === false) {
                message.warning('La connexion Internet est requise');
            } else if (res === true) {
                openNotification();
            }
        });
    }, []);

    // listener when click on pdf download button from document child view
    useEffect(() => {
        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.downloadDocumentPdf, downloadHandler);
        return () => {
            window.removeEventListener(
                CHILD_PARENT_WINDOW_EVENT.downloadDocumentPdf,
                downloadHandler,
            );
        };
    }, []);

    // listener download progress
    useEffect(() => {
        const cleanup = window.api.on.downloadDocumentPdfProgress((progress) => {
            if (progress === null) {
                window.setTimeout(() => {
                    notification.destroy();
                    message.success('Enregistr\u00e9');
                }, 1000);
                downloading.current = false;
            } else {
                downloading.current = true;
            }
        });
        return cleanup;
    }, []);

    return <></>;
}
