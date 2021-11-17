import { SearchItem, SearchMatchersValue } from '@localtypes/index';
import { asyncify, whilst } from '@main/functions/async';
import { getAssetDocumentsPath } from '@root/sys';
import { getFilename, performSearch } from '@root/utils/functions';
import fs from 'fs';
import { promisify } from 'util';
import { parse } from 'node-html-parser';

const docsPath = getAssetDocumentsPath();
const files = fs.existsSync(docsPath) ? fs.readdirSync(docsPath) : [];
const readFile = promisify(fs.readFile);

const DOC_MEMO: { [file: string]: { textContent: string } } = {};

export const searchHandler = (term: string) => {
  return new Promise<SearchItem[]>((resolve, reject) => {
    const documents_files = [...files];
    const results: SearchItem[] = [];

    const proceed = async () => {
      const index = files.length - documents_files.length;

      const file = documents_files.shift();
      if (!file) return;

      // remove .html extension on file
      let fileName = getFilename(file).split('.html')[0];

      // get file content and convert to string
      const documentBuffer = await (
        await readFile(getAssetDocumentsPath(file))
      ).toString('utf-8');

      // parse body and get textContent
      let bodyTextContent: string;
      if (!DOC_MEMO[file]) {
        const root = parse(documentBuffer);
        const body = root.querySelector('body');

        bodyTextContent = body?.textContent || '';
        DOC_MEMO[file] = { textContent: bodyTextContent };
      } else {
        bodyTextContent = DOC_MEMO[file].textContent;
      }

      // perform search
      const datas = performSearch<SearchMatchersValue>(term, bodyTextContent);

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