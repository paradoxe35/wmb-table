import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Col,
  Divider,
  Input,
  List,
  Modal,
  Row,
  Space,
  Typography,
  Upload,
  message,
} from 'antd';
import electron from 'electron';
import { IPC_EVENTS } from '../utils/ipc-events';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { appDatasLoaded, documentTitles } from '../store';
import { CustomDocument, UploadDocument } from '../types';
import sendIpcRequest from '../message-control/ipc/ipc-renderer';
import {
  FileAddOutlined,
  EyeOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { DeleteBtn } from '../components/delete-btn';
import { strNormalize } from '../utils/functions';
import DocumentViewer from '../components/viewer/document-viewer';

import { InboxOutlined } from '@ant-design/icons';
import { DraggerProps } from 'antd/lib/upload';
import { UploadFile } from 'antd/lib/upload/interface';

import { Spin } from 'antd';

const { Dragger } = Upload;

const { ipcRenderer } = electron;

export default function CustomDocuments() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const titles = useRecoilValue(documentTitles);

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleOk = () => {
    setIsModalVisible(false);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  useEffect(() => {
    ipcRenderer.on(IPC_EVENTS.open_modal_document_from_main, showModal);
  }, []);

  return (
    <>
      <Modal
        width="80%"
        title={
          <>
            <Space direction="horizontal">
              <span>Documents</span>
              <span>-</span>
              <div className="flex flex-center">
                <Typography.Text type="secondary">
                  Total({titles.length})
                </Typography.Text>
              </div>
            </Space>
          </>
        }
        visible={isModalVisible}
        footer={[]}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <Row>
          <Col span={11}>
            <CustomDocumentItem handleCancel={handleCancel} />
          </Col>
          <Col span={2}>
            <Divider style={{ minHeight: '250px' }} type="vertical" />
          </Col>
          <Col span={11}>
            <Uploader />
          </Col>
        </Row>
      </Modal>
    </>
  );
}

const DocumentTitle = ({ length }: { length: number }) => {
  const appLoaded = useRecoilValue(appDatasLoaded);

  return (
    <Space direction="horizontal">
      <Typography.Text type="secondary">
        Documents ajoutés ({length})
      </Typography.Text>
      {!appLoaded && <Spin indicator={<LoadingOutlined spin />} />}
    </Space>
  );
};

function CustomDocumentItem({ handleCancel }: { handleCancel: Function }) {
  const documentsRef = useRef<CustomDocument[]>([]);
  const [documents, setDocuments] = useState<CustomDocument[]>([]);
  const setTitles = useSetRecoilState(documentTitles);

  useEffect(() => {
    sendIpcRequest<CustomDocument[]>(IPC_EVENTS.custom_documents).then(
      (datas) => {
        documentsRef.current = datas;
        setDocuments(datas);
      }
    );
  }, []);

  useEffect(() => {
    const addDoc = (e: CustomEvent<CustomDocument[]>) => {
      documentsRef.current = [...e.detail, ...documentsRef.current];
      setDocuments(documentsRef.current);

      const titles = e.detail.map((f) => ({
        title: f.title,
        _id: f.documentId,
      }));

      setTitles((ts) => [...titles, ...ts]);
    };
    //@ts-ignore
    window.addEventListener('custom-document-added', addDoc);
    return () => {
      //@ts-ignore
      window.removeEventListener('custom-document-added', addDoc);
    };
  }, []);

  const onSearch = (value: string) => {
    if (documentsRef.current.length) {
      setDocuments(
        documentsRef.current.filter((d) =>
          strNormalize(d.title).includes(strNormalize(value))
        )
      );
    }
  };

  const setAppDataLoaded = useSetRecoilState(appDatasLoaded);

  const handleDeletion = (document: CustomDocument) => {
    setAppDataLoaded(false);
    sendIpcRequest(IPC_EVENTS.custom_documents_delete, document)
      .then(() => {
        documentsRef.current = documentsRef.current.filter(
          (d) => d.title != document.title
        );
        setTitles((ts) => ts.filter((t) => t.title != document.title));
        setDocuments(documentsRef.current);
      })
      .finally(() => setAppDataLoaded(true));
  };

  return (
    <>
      <div className="flex flex-center">
        <DocumentTitle length={documents.length} />
      </div>

      <div className="flex flex-center mt-2 mb-2">
        <Space direction="horizontal">
          <Input.Search onSearch={onSearch} />
        </Space>
      </div>

      <div style={{ overflow: 'auto', maxHeight: '300px' }}>
        <List
          itemLayout="horizontal"
          dataSource={documents}
          renderItem={(document) => (
            <List.Item
              actions={[
                <DocumentViewer
                  onItemClick={() => handleCancel()}
                  name={document.title}
                  id={document.documentId}
                >
                  <Button shape="circle" icon={<EyeOutlined />} />
                </DocumentViewer>,
                <DeleteBtn confirm={() => handleDeletion(document)} />,
              ]}
            >
              <List.Item.Meta
                avatar={<FileAddOutlined />}
                title={<span>{document.title}</span>}
              />
            </List.Item>
          )}
        />
      </div>
    </>
  );
}

function validateFile(file: File, showMessage: boolean = true) {
  const isJpgOrPng = file.type === 'application/pdf';
  if (!isJpgOrPng) {
    showMessage && message.error(`seul le format pdf est pris en charge.`);
  }
  const isLt2M = file.size / 1024 / 1024 <= 1;
  if (!isLt2M) {
    showMessage &&
      message.error('Le fichier doit être inférieur ou égal à 2Mo !');
  }
  return isJpgOrPng && isLt2M;
}

function Uploader() {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const titles = useRecoilValue(documentTitles);

  const props: DraggerProps = {
    name: 'file',
    multiple: true,
    accept: 'application/pdf',
    type: 'select',
    onRemove: (file) => {
      setFileList((fileList) => {
        const index = fileList.indexOf(file);
        const newFileList = fileList.slice();
        newFileList.splice(index, 1);
        return newFileList;
      });
    },
    beforeUpload: (file) => {
      if (
        !validateFile(file, false) ||
        fileList.length >= 10 ||
        !file.name.endsWith('.pdf')
      )
        return false;

      setFileList((fileList) => [...fileList, file]);
      return false;
    },
    fileList,
  };

  async function handleUpload() {
    if (fileList.length === 0) return;

    const titlesList = titles.map((d) => `${d.title}.pdf`);

    for (const file of fileList) {
      if (titlesList.includes(file.name)) {
        message.error(`Le document avec nom '${file.name}' existe déjà`);
        return false;
      }
    }

    setUploading(true);

    const paths: UploadDocument[] = fileList
      .map((d) => ({
        name: d.name,
        //@ts-ignore
        path: d.path,
      }))
      .filter((d) => d.path);

    sendIpcRequest<CustomDocument[]>(IPC_EVENTS.custom_documents_store, paths)
      .then((docs) => {
        window.dispatchEvent(
          new CustomEvent<CustomDocument[]>('custom-document-added', {
            detail: docs,
          })
        );
        message.success(`Documents ajoutés avec succès`);
        setFileList([]);
      })
      .finally(() => setUploading(false));
    return;
  }

  return (
    <>
      <div className="flex flex-center mb-2">
        <Typography.Text type="secondary">Nouveaux Documents</Typography.Text>
      </div>

      <div
        style={{
          overflow: 'auto',
          maxHeight: '400px',
          padding: '0 10px',
          marginBottom: '10px',
        }}
      >
        <div className="flex flex-center mb-2">
          <Dragger {...props}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <div style={{ padding: '0 9px' }}>
              <p className="ant-upload-text">
                Cliquez et déposer les fichiers dans cette zone pour Télécharger
              </p>
              <p className="ant-upload-hint">
                Seuls les fichiers PDF sont pris en charge (taille maximale 1Mo)
                <br />
                Vous ne pouvez envoyer que 10 fichiers par téléchargement
              </p>
            </div>
          </Dragger>
        </div>
      </div>
      <div className="flex flex-center">
        <Button
          type="primary"
          onClick={handleUpload}
          disabled={fileList.length === 0}
          loading={uploading}
          style={{ margin: '0 10px' }}
        >
          {uploading ? 'Téléchargement' : 'Télécharger'}
        </Button>
      </div>
    </>
  );
}
