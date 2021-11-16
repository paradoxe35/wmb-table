const convert = require('./pdf2html/pdf2html-ex');

/**
 *
 * @param {import('@localtypes/index').UploadDocument & {childForked?:boolean}} file
 */
const hanlder = async (file) => {
  if (
    !file.childForked ||
    !process.send ||
    !process.env.ASSETS_PATH ||
    !process.env.ASSETS_DOCUMENTS_PATH
  ) {
    process.send && process.send(null);
    return;
  }

  const getContent = await convert(file.path, file.name);
  if (getContent) {
    /**
     * @type {import('./types').ConvertMessage}
     */
    const message = { fileName: file.name, ...getContent };
    process.send(message);
  } else {
    process.send(null);
  }
};

process.on('message', hanlder);
