//@ts-check
const pdftohtml = require('./pdf2html-ex/pdftohtml');
const fs = require('fs');
//@ts-ignore
const pdf = require('pdf-parse');
const { strNormalizeNoLower } = require('../common/functions');

module.exports = async (
  /** @type {number | fs.PathLike} */ srcFilePdf,
  /** @type {string} */ fileName
) => {
  fileName = fileName.split('.pdf')[0];
  /** @type {string} */
  // @ts-ignore
  const documentsPath = process.env.ASSETS_DOCUMENTS_PATH;

  if (!fs.existsSync(documentsPath)) {
    fs.mkdirSync(documentsPath);
  }

  //@ts-ignore
  const converter = new pdftohtml(srcFilePdf, documentsPath);

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
