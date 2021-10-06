// @ts-ignore
const request = require('request');
// @ts-ignore
const unzipper = require('unzipper');
// @ts-ignore
const progress = require('request-progress');
const chalk = require('chalk');
const path = require('path');

const { EventEmitter } = require('events');

const event = new EventEmitter({ captureRejections: true });

const message = {
  assetProgress: '',
  dataProgress: '',
};
event.on('progress', () => {
  process.stdout.write(`${message.dataProgress} - ${message.assetProgress}\r`);
});

// extract datas zip
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
  .pipe(unzipper.Extract({ path: path.resolve(__dirname, '../') }));

// extract assets datas zip
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
  .pipe(unzipper.Extract({ path: path.resolve(__dirname, '../assets') }));
