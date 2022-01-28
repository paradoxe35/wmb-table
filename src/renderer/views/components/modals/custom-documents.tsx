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
  Progress,
} from 'antd';
import electron from 'electron';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import {
  SetterOrUpdater,
  useRecoilState,
  useRecoilValue,
  useSetRecoilState,
} from 'recoil';
import {
  appDatasLoadedStore,
  customDocumentsStore,
  documentTitlesStore,
  titlesStore,
} from '@renderer/store';
import {
  CustomDocument,
  CustomDocumentUploadProgress,
  Title,
  UploadDocument,
} from '@localtypes/index';
import sendIpcRequest from '@root/ipc/ipc-renderer';
import {
  FileAddOutlined,
  EyeOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { DeleteBtn } from '@renderer/components/delete-btn';
import DocumentViewer from '@renderer/components/viewer/document-viewer';

import { InboxOutlined, RedoOutlined } from '@ant-design/icons';
import { DraggerProps } from 'antd/lib/upload';
import { UploadFile } from 'antd/lib/upload/interface';

import { Spin } from 'antd';
import { useIpcRequestWithLoader, useModalVisible } from '@renderer/hooks';
import { CUSTOM_DOCUMENT_EVENT } from '@modules/shared/shared';
import { simpleRegExp, strNormalize } from '@modules/shared/searchable';

const { Dragger } = Upload;

const { ipcRenderer } = electron;

export default function CustomDocuments() {
  const {
    showModal,
    isModalVisible,
    handleOk,
    handleCancel,
  } = useModalVisible();

  const titles = useRecoilValue(documentTitlesStore);

  const [customDocuments, setCustomDocuments] = useRecoilState<
    CustomDocument[]
  >(customDocumentsStore);

  useEffect(() => {
    sendIpcRequest<CustomDocument[]>(IPC_EVENTS.custom_documents).then(
      (datas) => {
        setCustomDocuments(datas);
      }
    );
  }, []);

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
            <CustomDocumentItem
              customDocuments={customDocuments}
              setCustomDocuments={setCustomDocuments}
              handleCancel={handleCancel}
            />
          </Col>
          <Col span={2}>
            <Divider style={{ minHeight: '250px' }} type="vertical" />
          </Col>
          <Col span={11}>
            <UploaderWrapper />
          </Col>
        </Row>
      </Modal>
    </>
  );
}

const DisabledArea = ({
  component,
  active,
}: {
  component: JSX.Element;
  active: boolean;
}) => {
  return active ? (
    component
  ) : (
    <div className="area-wrapper">
      <div className="area-content">
        <Button type="primary" shape="circle" icon={<RedoOutlined />} />
        <br />
        <Button type="dashed" disabled>
          Desactivé
        </Button>
        <br />
        <Button type="dashed">
          <Typography.Link
            target="_blank"
            href={process.env.DOCS_CUSTOM_DOCUMENT_LINK}
          >
            Documentation
          </Typography.Link>
        </Button>
      </div>
      {component}
    </div>
  );
};

const UploaderWrapper = () => {
  const [canUpload] = useState<boolean>(true);

  return <DisabledArea component={<Uploader />} active={canUpload} />;
};

const DocumentTitle = ({ length }: { length: number }) => {
  const appLoaded = useRecoilValue(appDatasLoadedStore);

  return (
    <Space direction="horizontal">
      <Typography.Text type="secondary">
        Documents ajoutés ({length})
      </Typography.Text>
      {!appLoaded && <Spin indicator={<LoadingOutlined spin />} />}
    </Space>
  );
};

function CustomDocumentItem({
  handleCancel,
  customDocuments,
  setCustomDocuments,
}: {
  handleCancel: Function;
  customDocuments: CustomDocument[];
  setCustomDocuments: SetterOrUpdater<CustomDocument[]>;
}) {
  const [documents, setDocuments] = useState<CustomDocument[]>([]);
  const setTitles = useSetRecoilState(titlesStore);

  useEffect(() => {
    setDocuments(customDocuments);
  }, [customDocuments]);

  useEffect(() => {
    const addDoc = (e: CustomEventInit<CustomDocument[]>) => {
      setCustomDocuments((ds) => [...(e.detail || []), ...ds]);

      const titles = (e.detail || []).map(
        (f) =>
          ({
            _id: f.documentId,
            title: f.title,
            frTitle: f.title,
            enTitle: f.title,
            date: null,
            date_long: null,
            web_link: null,
            pdf_link: null,
            audio_link: null,
            traduction: null,
            other_traductions: [],
          } as Title<string | null>)
      );

      setTitles((ts) => [...titles, ...ts]);
    };
    window.addEventListener(CUSTOM_DOCUMENT_EVENT.customDocumentAdded, addDoc);
    return () => {
      window.removeEventListener(
        CUSTOM_DOCUMENT_EVENT.customDocumentAdded,
        addDoc
      );
    };
  }, []);

  const onSearch = (value: string) => {
    if (customDocuments.length) {
      setDocuments(
        customDocuments.filter((d) =>
          simpleRegExp(value).test(strNormalize(d.title))
        )
      );
    }
  };

  const ipcRequestWithLoader = useIpcRequestWithLoader();

  const handleDeletion = (document: CustomDocument) => {
    ipcRequestWithLoader(IPC_EVENTS.custom_documents_delete, document).then(
      () => {
        setCustomDocuments((ds) => ds.filter((d) => d.title != document.title));
        setTitles((ts) => ts.filter((t) => t.title != document.title));
        window.dispatchEvent(
          new CustomEvent<CustomDocument>(
            CUSTOM_DOCUMENT_EVENT.customDocumentRemoved,
            {
              detail: document,
            }
          )
        );
      }
    );
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
  const isLt8k = file.size / 1024 / 1024 <= 0.8;
  if (!isLt8k) {
    showMessage &&
      message.error('Le fichier doit être inférieur ou égal à 2Mo !');
  }
  return isJpgOrPng && isLt8k;
}

type UploadFilePath = UploadFile & { path?: string };

function Uploader() {
  const [fileList, setFileList] = useState<UploadFilePath[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);

  const uploadElRef = useRef<HTMLDivElement | null>(null);

  const [uploadProgress, setUploadProgress] = useState<
    CustomDocumentUploadProgress | undefined
  >();

  const titles = useRecoilValue(documentTitlesStore);

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

      setFileList((fileList) => {
        if (fileList.some((f) => f.name === file.name)) {
          return fileList;
        } else {
          return [...fileList, file];
        }
      });
      return false;
    },
    fileList,
  };

  async function handleUpload() {
    if (fileList.length === 0) return;

    const titlesList = titles.map((d) => `${d.getTitle()}.pdf`);

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
        path: d.path!,
      }))
      .filter((d) => d.path);

    sendIpcRequest<CustomDocument[]>(IPC_EVENTS.custom_documents_store, paths)
      .then((_docs) => {
        if (_docs.length > 0) {
          message.success(`Téléchargement terminé`);
          setFileList((files) => {
            return files.filter(
              (f) => !_docs.some((b) => f.name.includes(b.title))
            );
          });
        }
      })
      .finally(() => setUploading(false));
    return;
  }

  // handle all commit uploaded document and error
  useEffect(() => {
    const handle_uploaded_file = (_e: any, doc: CustomDocument) => {
      window.dispatchEvent(
        new CustomEvent<CustomDocument[]>(
          CUSTOM_DOCUMENT_EVENT.customDocumentAdded,
          {
            detail: [doc],
          }
        )
      );
    };
    // every time when a file is uploaded successfully
    ipcRenderer.on(
      IPC_EVENTS.custom_document_uploaded_file,
      handle_uploaded_file
    );
  }, []);

  useEffect(() => {
    // upload progress handler
    const upload_progress = (_: any, data: CustomDocumentUploadProgress) => {
      if (data.type === 'progress') {
        setUploadProgress(data);
      } else {
        window.setTimeout(() => {
          setUploadProgress(undefined);
        }, 2000);
      }
    };
    // upload progress event listeners
    ipcRenderer.on(IPC_EVENTS.custom_document_upload_progress, upload_progress);
  }, []);

  // catch error on uploading document progress, specially when there's no connectin
  useEffect(() => {
    const handler = () =>
      message.warn(
        'Vous devez être connecté à Internet pour télécharger le document'
      );
    ipcRenderer.on(IPC_EVENTS.custom_document_connection_required, handler);
  }, []);

  // scroll to bo ttom container when new file added
  useEffect(() => {
    if (fileList.length > 0) {
      window.setTimeout(() => {
        if (uploadElRef.current) {
          uploadElRef.current.scrollTo({
            behavior: 'smooth',
            top: uploadElRef.current.scrollHeight,
          });
        }
      }, 500);
    }
  }, [fileList]);

  return (
    <>
      <div className="flex flex-center mb-2">
        <Typography.Text type="secondary">Nouveaux Documents</Typography.Text>
      </div>

      <div
        ref={uploadElRef}
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
                Seuls les fichiers PDF sont pris en charge (taille maximale
                800KB)
                <br />
                Vous ne pouvez envoyer que 10 fichiers par téléchargement
              </p>
            </div>
          </Dragger>
        </div>
      </div>
      <div className="flex flex-center">
        {uploading && uploadProgress?.type === 'progress' ? (
          <Space direction="vertical">
            <Space direction="horizontal">
              <span>Téléchargement</span>
              <Spin
                indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />}
              />
            </Space>
            <div style={{ width: 170 }}>
              <Progress
                percent={parseInt(
                  (
                    (uploadProgress.progress * 100) /
                    uploadProgress.total
                  ).toFixed(2),
                  10
                )}
                size="small"
              />
            </div>
          </Space>
        ) : (
          <Button
            type="primary"
            onClick={handleUpload}
            disabled={fileList.length === 0}
            loading={uploading}
            style={{ margin: '0 10px' }}
          >
            {uploading ? 'Téléchargement' : 'Télécharger'}
          </Button>
        )}
      </div>
    </>
  );
}
