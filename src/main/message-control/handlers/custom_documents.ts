import {
  CustomDocument,
  CustomDocumentUploadProgress,
  CustomDocumentUploadProgressType,
  Title,
  UploadDocument,
} from '@localtypes/index';
import db, { queryDb } from '@main/db/db';
import fs from 'fs';
import {
  childsProcessesPath,
  getAssetDocumentsPath,
  getAssetPath,
} from '@root/sys';
import { asyncify, doWhilst, whilst } from '@main/functions/async';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import childProcess from 'child_process';
import { ConvertMessage } from '../../childs_processes/types';
import { fileListHasChanged } from '@main/db/searchable/documents';
import { sendIpcToRenderer } from '@root/ipc/ipc-main';

export default async () => {
  return await queryDb.find<CustomDocument>(
    db.customDocuments,
    {},
    {},
    {
      createdAt: -1,
    }
  );
};

export function custom_documents_delete(_: any, document: CustomDocument) {
  const proceed = async () => {
    fs.unlink(getAssetDocumentsPath(`${document.title}.html`), () => {});
    await queryDb.remove<boolean>(db.customDocuments, { _id: document._id });
    await queryDb.remove<boolean>(db.documentsTitle, { title: document.title });
  };

  return new Promise((resolve, reject) => {
    doWhilst(
      asyncify(proceed),
      asyncify(() => false),
      (_err: any) => (_err ? reject(_err) : resolve(true))
    );
  });
}

function commitUploadProgress(
  type: CustomDocumentUploadProgressType,
  progress: number,
  total: number
) {
  sendIpcToRenderer(IPC_EVENTS.custom_document_upload_progress, {
    type,
    progress,
    total,
  } as CustomDocumentUploadProgress);
}

export async function custom_documents_store(
  _: any,
  documents: UploadDocument[]
) {
  process.env.ASSETS_PATH = getAssetPath();
  process.env.ASSETS_DOCUMENTS_PATH = getAssetDocumentsPath();
  const child = childProcess.fork(childsProcessesPath('pdf2html.js'), {
    env: process.env,
  });

  return new Promise<CustomDocument[]>((resolve, reject) => {
    const newDocuments = documents.slice();
    const docs: CustomDocument[] = [];

    commitUploadProgress('progress', 0, documents.length);

    const convert = <T>(file: UploadDocument) => {
      child.send({ ...file, childForked: true });

      return new Promise<T | null>((resolve) => {
        child.once('message', (message: ConvertMessage) => {
          if (message) {
            resolve(({
              title: message.title,
            } as unknown) as T);
          } else {
            resolve(null);
          }
        });
      });
    };

    const proceed = async () => {
      const file = newDocuments.shift();
      if (!file) return;

      const getContent = await convert<{
        title: string;
      }>(file);

      if (getContent) {
        await queryDb.insert<Title>(db.documentsTitle, {
          _id: undefined,
          title: getContent.title,
          frTitle: getContent.title,
          enTitle: getContent.title,
          date: null,
          date_long: null,
          web_link: null,
          pdf_link: null,
          audio_link: null,
          traduction: null,
          other_traductions: [],
        } as Title<string | null, undefined>);

        const doc = await queryDb.insert<CustomDocument>(db.customDocuments, {
          title: getContent.title,
        } as CustomDocument);

        docs.push(doc);
      }

      commitUploadProgress(
        'progress',
        documents.length - newDocuments.length,
        documents.length
      );
    };

    whilst(
      asyncify(() => newDocuments.length !== 0),
      asyncify(proceed),
      (_err: any) => {
        if (_err) {
          reject(_err);
        } else {
          resolve(docs.sort((a, b) => b.createdAt - a.createdAt));
          fileListHasChanged.value = true;
        }
        child.kill('SIGINT');
        commitUploadProgress('finish', 0, 0);
      }
    );
  });
}
