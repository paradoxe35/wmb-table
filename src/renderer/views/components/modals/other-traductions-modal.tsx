import { Button, List, Modal, Tooltip } from 'antd';
import { useEffect, useMemo } from 'react';
import { OtherTraduction } from '@shared/types';
import { useSermonLookup, useModalVisible, useActiveTabTitle } from '@renderer/hooks';
import { BookOutlined, EyeOutlined } from '@ant-design/icons';
import { CHILD_PARENT_WINDOW_EVENT } from '@renderer/utils/events';
import { TRADUCTIONS } from '@renderer/utils/constants';
import DocumentViewer from '@renderer/components/viewer/document-viewer';

export function OtherTraductionsModal() {
    const { visible, hide, setVisible } = useModalVisible();

    const { sermonsByTitle } = useSermonLookup();
    const title = useActiveTabTitle();

    const traductions = useMemo(() => {
        if (!title || !sermonsByTitle[title]) return [];
        // SermonMeta doesn't have other_traductions directly;
        // For now return empty — translations are fetched via API if needed
        return [] as OtherTraduction[];
    }, [title, sermonsByTitle]);

    useEffect(() => {
        const showModal = () => {
            setVisible(true);
        };

        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.openOtherTraductionsModal, showModal);
        return () => {
            window.removeEventListener(
                CHILD_PARENT_WINDOW_EVENT.openOtherTraductionsModal,
                showModal,
            );
        };
    }, []);

    return (
        <Modal
            title={
                <div className="mr-2">
                    Autres Traductions du document: <em>{title}</em>
                </div>
            }
            footer={[]}
            visible={visible}
            onOk={hide}
            onCancel={hide}
        >
            <div style={{ overflow: 'auto', height: '300px' }}>
                <ContentModal handleCancel={hide} traductions={traductions} />
            </div>
        </Modal>
    );
}

function ContentModal({
    traductions,
    handleCancel,
}: {
    traductions: OtherTraduction[];
    handleCancel: () => void;
}) {
    return (
        <>
            <List
                itemLayout="horizontal"
                dataSource={traductions}
                renderItem={(traduction, i) => {
                    return (
                        <List.Item
                            actions={[
                                <DocumentViewer
                                    key={traduction.title + 'documentViewer'}
                                    name={traduction.title}
                                >
                                    <Tooltip title={'Ouvrir le document'}>
                                        <Button
                                            key={traduction.title + 'button'}
                                            onClick={handleCancel}
                                            shape="circle"
                                            icon={<EyeOutlined />}
                                        />
                                    </Tooltip>
                                </DocumentViewer>,
                            ]}
                        >
                            <List.Item.Meta
                                avatar={<BookOutlined />}
                                description={`Traduction: ${TRADUCTIONS[traduction.traduction]}`}
                                title={i + 1 + '. ' + traduction.title}
                            />
                        </List.Item>
                    );
                }}
            />
        </>
    );
}
