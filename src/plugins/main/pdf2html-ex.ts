//@ts-check
import pdftohtml from './pdf2html-ex/pdftohtml';
import fs from 'fs';
//@ts-ignore
import pdf from 'pdf-parse';
import { getAssetPath } from '../../sys';
import { strNormalizeNoLower } from '../../utils/functions';

export const convert = async (srcFilePdf: string, fileName: string) => {
  fileName = fileName.split('.pdf')[0];
  const documentsPath = getAssetPath('datas/documents');

  if (!fs.existsSync(documentsPath)) {
    fs.mkdirSync(documentsPath);
  }

  //@ts-ignore
  const converter = new pdftohtml(srcFilePdf, getAssetPath(`datas/documents`));

  try {
    await converter.convert('default');
    let dataBuffer = fs.readFileSync(srcFilePdf);

    return {
      title: fileName,
      textContent: strNormalizeNoLower((await pdf(dataBuffer)).text),
    };
  } catch (err) {
    console.error(`Psst! something went wrong: ${err}`);
  }

  return null;
};
