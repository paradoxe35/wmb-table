const pdf = require('html-pdf');
const fs = require('fs');

(async () => {
  const path = process.env.FILE_PATH;
  const data = process.env.HTML_DATA;

  if (!path || !data || !process.send) {
    process.send && process.send(null);
    return;
  }

  try {
    pdf
      .create(data, {
        childProcessOptions: { detached: false },
        phantomPath: undefined,
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
