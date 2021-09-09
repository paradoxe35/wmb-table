const convert = require('./pdf2html/pdf2html-ex');

/**
 *
 * @param {import('../types').UploadDocument & {childForked?:boolean}} file
 */
const hanlder = async (file) => {
  console.log(process.env.ASSETS_PATH, process.env.ASSETS_DOCUMENTS_PATH);
  if (
    !file.childForked ||
    !process.send ||
    !process.env.ASSETS_PATH ||
    !process.env.ASSETS_DOCUMENTS_PATH
  )
    return;

  console.log(
    process.env.ASSETS_PATH,
    process.env.ASSETS_DOCUMENTS_PATH,
    'passed'
  );
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
