import { SearchItem } from '@localtypes/index';
import { asyncify, whilst } from '@main/functions/async';
import { getAssetDocumentsPath } from '@root/sys';
import { getFilename } from '@root/utils/functions';
import fs from 'fs';
import { promisify } from 'util';
import { parse } from 'node-html-parser';
import {
  DOCUMENT_CONTAINER_ID,
  DOCUMENT_CONTENT_ID,
} from '@modules/shared/shared';
import { performSearch, strNormalizeNoLower } from '@modules/shared/searchable';

const docsPath = getAssetDocumentsPath();
const getFiles = () =>
  fs.existsSync(docsPath) ? fs.readdirSync(docsPath) : [];

let files = getFiles();
const readFile = promisify(fs.readFile);

export const fileListHasChanged = {
  value: false,
};

const DOC_MEMO: { [file: string]: { textContent: string } } = {};

export const searchHandler = (term: string) => {
  if (fileListHasChanged.value) {
    files = getFiles();
    fileListHasChanged.value = false;
  }

  return new Promise<SearchItem[]>((resolve, reject) => {
    const documents_files = [...files];
    const results: SearchItem[] = [];

    const proceed = async () => {
      const index = files.length - documents_files.length;

      const file = documents_files.shift();

      if (!file) return;

      const fullFilePath = getAssetDocumentsPath(file);

      if (!fs.existsSync(fullFilePath)) return;

      // remove .html extension on file
      let fileName = getFilename(file).split('.html')[0];

      // get file content and convert to string
      const documentBuffer = (await readFile(fullFilePath)).toString('utf-8');

      // parse body and get textContent
      let bodyTextContent: string;

      if (!DOC_MEMO[file]) {
        const root = parse(documentBuffer);

        const body =
          root.querySelector(`.${DOCUMENT_CONTENT_ID}`) ||
          root.querySelector(`#${DOCUMENT_CONTAINER_ID}`);

        bodyTextContent = strNormalizeNoLower(body?.textContent || '');
        DOC_MEMO[file] = { textContent: bodyTextContent };
      } else {
        bodyTextContent = DOC_MEMO[file].textContent;
      }

      // perform search
      const datas = performSearch(term, bodyTextContent);

      if (datas.length === 0) return;

      results.push({
        item: {
          _id: '',
          createdAt: undefined,
          updatedAt: undefined,
          title: fileName,
          textContent: bodyTextContent,
        },
        matches: datas,
        refIndex: index,
      });
    };

    whilst(
      asyncify(() => documents_files.length !== 0),
      asyncify(proceed),
      (_err: any) => {
        if (_err) {
          reject(_err);
        } else {
          resolve(results);
        }
      }
    );
  });
};
