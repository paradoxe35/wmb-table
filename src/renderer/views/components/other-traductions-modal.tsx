import { Button, List, Modal, Tooltip } from 'antd';
import React, { useEffect, useMemo } from 'react';
import { OtherTraduction } from '@localtypes/index';
import { useModalVisible } from '@renderer/hooks';
import { BookOutlined, EyeOutlined } from '@ant-design/icons';
import { useRecoilValue } from 'recoil';
import {
  currentDocumentTabsSelector,
  titlesDocumentSelector,
} from '@renderer/store';
import { CHILD_PARENT_WINDOW_EVENT } from '@modules/shared/shared';
import { TRADUCTIONS } from '@root/utils/constants';
import DocumentViewer from '@renderer/components/viewer/document-viewer';

export function OtherTraductionsModal() {
  const {
    isModalVisible,
    handleOk,
    handleCancel,
    setIsModalVisible,
  } = useModalVisible();

  const $titles = useRecoilValue(titlesDocumentSelector);
  const title = useRecoilValue(currentDocumentTabsSelector);

  const traductions = useMemo(() => {
    return $titles[title]?.getTraductions() || [];
  }, [title, $titles]);

  useEffect(() => {
    const showModal = () => {
      setIsModalVisible(true);
    };

    window.addEventListener(
      CHILD_PARENT_WINDOW_EVENT.openOtherTraductionsModal,
      showModal
    );
    return () => {
      window.removeEventListener(
        CHILD_PARENT_WINDOW_EVENT.openOtherTraductionsModal,
        showModal
      );
    };
  }, []);

  return (
    <Modal
      title={
        <span>
          Autres Traductions du document: <em>{title}</em>
        </span>
      }
      footer={[]}
      visible={isModalVisible}
      onOk={handleOk}
      onCancel={handleCancel}
    >
      <div style={{ overflow: 'auto', height: '300px' }}>
        <ContentModal handleCancel={handleCancel} traductions={traductions} />
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
                  <Tooltip
                    title={'Ouvrir le document'}
                    children={[
                      <Button
                        key={traduction.title + 'button'}
                        onClick={handleCancel}
                        shape="circle"
                        icon={<EyeOutlined />}
                      />,
                    ]}
                  />
                </DocumentViewer>,
              ]}
            >
              <List.Item.Meta
                avatar={<BookOutlined />}
                description={`Traduction: ${
                  TRADUCTIONS[traduction.traduction]
                }`}
                title={i + 1 + '. ' + traduction.title}
              />
            </List.Item>
          );
        }}
      />
    </>
  );
}
