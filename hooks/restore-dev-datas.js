const request = require('request');
// @ts-ignore
const progress = require('request-progress');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const extract = require('extract-zip');

const { EventEmitter } = require('events');

const event = new EventEmitter({ captureRejections: true });

const message = {
  assetProgress: '',
  dataProgress: '',
};
event.on('progress', () => {
  process.stdout.write(`${message.dataProgress} - ${message.assetProgress}\r`);
});

/**
 * @param {string} filename
 * @param {any} dist
 */
async function extactZip(filename, dist) {
  await extract(filename, { dir: dist });
  fs.unlinkSync(filename);
}

// extract datas zip
const datasFile = path.resolve(__dirname, '../tmp/1.zip');
progress(
  request(
    'https://github.com/paradoxe35/wmb-table/releases/download/v1.0.0/datas.zip'
  )
)
  // @ts-ignore
  .on('progress', function (state) {
    message.dataProgress =
      chalk.blueBright.bold('extract data: ') +
      ((state.percent * 100) / 1).toFixed(0);
    event.emit('progress');
  })
  .on('end', () => extactZip(datasFile, path.resolve(__dirname, '../')))
  .pipe(fs.createWriteStream(datasFile));

// extract assets datas zip ----------------------------------------------------------------------
// ----------------------------------------------------------------------

const assetsDatasFile = path.resolve(__dirname, '../tmp/2.zip');
progress(
  request(
    'https://github.com/paradoxe35/wmb-table/releases/download/v1.0.0/assets-datas.zip'
  )
)
  // @ts-ignore
  .on('progress', function (state) {
    message.assetProgress =
      chalk.cyanBright.bold('extract assets data: ') +
      ((state.percent * 100) / 1).toFixed(0);
    event.emit('progress');
  })
  .on('end', () =>
    extactZip(assetsDatasFile, path.resolve(__dirname, '../assets'))
  )
  .pipe(fs.createWriteStream(assetsDatasFile));
