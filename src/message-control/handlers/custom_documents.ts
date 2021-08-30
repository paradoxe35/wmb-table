import {
  CustomDocument,
  CustomDocumentUploadProgress,
  CustomDocumentUploadProgressType,
  DataDocument,
  Title,
  UploadDocument,
} from '../../types';
import db, { loadDatabase, queryDb } from '../../utils/main/db';
import fs from 'fs';
import { getAssetDocumentsPath, mainWindow } from '../../sys';
import { convert } from '../../plugins/main/pdf2html-ex';
import { asyncify, doWhilst, whilst } from '../../utils/async';
import { IPC_EVENTS } from '../../utils/ipc-events';

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
  // preload document db to make sur the reste proccess of storing will success
  loadDatabase(db.documents);

  const proceed = async () => {
    fs.unlink(getAssetDocumentsPath(`${document.title}.html`), () => {});
    await queryDb.remove<boolean>(db.documents, { _id: document.documentId });
    await queryDb.remove<boolean>(db.customDocuments, { _id: document._id });
    await queryDb.remove<boolean>(db.documentsTitle, { title: document.title });
  };

  return new Promise((resolve, reject) => {
    doWhilst(
      asyncify(proceed),
      asyncify(() => false),
      (_err) => (_err ? reject(_err) : resolve(true))
    );
  });
}

function commitUploadProgress(
  type: CustomDocumentUploadProgressType,
  progress: number,
  total: number
) {
  if (mainWindow) {
    mainWindow.webContents.send(IPC_EVENTS.custom_document_upload_progress, {
      type,
      progress,
      total,
    } as CustomDocumentUploadProgress);
  }
}

export function custom_documents_store(_: any, documents: UploadDocument[]) {
  // preload document db to make sur the reste proccess of storing will success
  loadDatabase(db.documents);

  return new Promise<CustomDocument[]>((resolve, reject) => {
    const newDocuments = documents.slice();
    const docs: CustomDocument[] = [];

    commitUploadProgress('progress', 0, documents.length);

    const proceed = async () => {
      const file = newDocuments.shift();
      if (!file) return;

      const getContent = await convert(file.path, file.name);
      if (getContent) {
        const savedDoc = await queryDb.insert<DataDocument>(
          db.documents,
          getContent
        );

        await queryDb.insert<any>(db.documentsTitle, ({
          title: savedDoc.title,
          name: savedDoc.title,
          year: null,
        } as unknown) as Partial<Title>);

        const doc = await queryDb.insert<CustomDocument>(db.customDocuments, {
          documentId: savedDoc._id,
          title: savedDoc.title,
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
      (_err) => {
        if (_err) {
          reject(_err);
        } else {
          resolve(docs.sort((a, b) => b.createdAt - a.createdAt));
        }
        commitUploadProgress('finish', 0, 0);
      }
    );
  });
}
