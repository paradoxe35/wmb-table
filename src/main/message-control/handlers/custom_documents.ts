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
  getPdf2HtmlPath,
} from '@root/sys';
import { asyncify, doWhilst, whilst } from '@main/functions/async';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import childProcess from 'child_process';
import { ConvertMessage } from '../../childs_processes/types';
import { fileListHasChanged } from '@main/db/searchable/documents';
import { sendIpcToRenderer } from '@root/ipc/ipc-main';
import isOnline from 'is-online';
import request from 'request';
import { getFilename } from '@root/utils/functions';

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

// send upload progress to renderer process
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

// commit this file is  uploaded
function commit_uploaded_document(doc: CustomDocument) {
  sendIpcToRenderer(IPC_EVENTS.custom_document_uploaded_file, doc);
}

// copy all custom  document assets
function copy_document_assets() {
  const assets = ['compatibility.min.js', 'pdf2htmlEX.min.js'];

  assets
    .filter((asset) => !fs.existsSync(getAssetDocumentsPath(asset)))
    .forEach((asset) => {
      const source = getPdf2HtmlPath('data', asset);
      const des = getAssetDocumentsPath(asset);
      fs.copyFileSync(source, des);
    });
}
// copy all files at app startup
copy_document_assets();

// entry for documents uploading
export async function custom_documents_store(
  _: any,
  documents: UploadDocument[]
) {
  const pdf2html_link = process.env.PDF2HTML_LINK;
  process.env.PDF2HTML_LINK =
    pdf2html_link || 'https://wmb-table-pdf2html.herokuapp.com/convert';

  let platform = process.platform;

  let datas = await convertion(documents, platform);
  /**
   * if conversion has failed on win35 by local conversion then try again from online conversion
   */
  if (datas.length === 0 && platform === 'win32') {
    platform = 'darwin';
    datas = await convertion(documents, platform);
  }

  return datas;
}

// only on windows
async function convertion(
  documents: UploadDocument[],
  platform: NodeJS.Platform
) {
  process.env.ASSETS_PATH = getAssetPath();
  process.env.ASSETS_DOCUMENTS_PATH = getAssetDocumentsPath();

  let child: childProcess.ChildProcess | undefined;
  // support local conversion only on windows
  if (platform === 'win32') {
    child = childProcess.fork(childsProcessesPath('pdf2html.js'), {
      env: process.env,
    });
  } else {
    // check if user has connection
    const online = await isOnline();
    if (!online) {
      sendIpcToRenderer(IPC_EVENTS.custom_document_connection_required);
      return [];
    }
  }

  return new Promise<CustomDocument[]>((resolve, reject) => {
    const newDocuments = documents.slice();
    const docs: CustomDocument[] = [];

    commitUploadProgress('progress', 0, documents.length);

    const local_convert = <T>(file: UploadDocument) => {
      child?.send({ ...file, childForked: true });

      return new Promise<T | null>((resolve) => {
        child?.once('message', (message: ConvertMessage) => {
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

    const online_conversion = <T>(file: UploadDocument) => {
      const filename = getFilename(file.name);

      return new Promise<T | null>((resolve) => {
        const req = request.post(
          process.env.PDF2HTML_LINK!,
          (_err, _res, body) => {
            if (_err) return resolve(null);

            const html_file = filename.replace('.pdf', '.html');

            fs.writeFile(getAssetDocumentsPath(html_file), body, (err) => {
              if (err) return resolve(null);
              copy_document_assets();
              resolve(({ title: filename.split('.pdf')[0] } as unknown) as T);
            });
          }
        );

        const form = req.form();
        form.append('pdf_file', fs.createReadStream(file.path));
      });
    };

    const proceed = async () => {
      const file = newDocuments.shift();
      if (!file) return;

      type R = { title: string } | null;

      let getContent: R = null;

      if (platform === 'win32') {
        getContent = await local_convert<R>(file);
      } else {
        getContent = await online_conversion<R>(file);
      }

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

        // commit event to renderer process about uploaded file
        commit_uploaded_document(doc);
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
        child?.kill('SIGINT');
        commitUploadProgress('finish', 0, 0);
      }
    );
  });
}
