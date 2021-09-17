const pdf = require('html-pdf');
const fs = require('fs');

(async () => {
  const path = process.env.FILE_PATH;
  let data = process.env.HTML_DATA;

  if (!path || !data || !process.send) {
    process.send && process.send(null);
    return;
  }

  data = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{ font-family: sans-serif;}</style></head><body>${data}</body></html>`;

  try {
    pdf
      .create(data, {
        childProcessOptions: { detached: false },
        phantomPath: undefined,
        format: 'A4',
        type: 'pdf',
        border: {
          top: '0.3in',
          right: '0.3in',
          bottom: '0.3in',
          left: '0.3in',
        },
        quality: '99',
        orientation: 'portrait',
      })
      .toStream(function (err, stream) {
        if (err) {
          // @ts-ignore
          process.send(null);
          return;
        }

        stream
          .pipe(fs.createWriteStream(path))
          // @ts-ignore
          .on('finish', () => process.send(true))
          // @ts-ignore
          .on('error', () => process.send(null));
      });
  } catch (_) {
    process.send(null);
  }
})();
