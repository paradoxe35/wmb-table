// @ts-ignore
const request = require('request');
// @ts-ignore
const unzipper = require('unzipper');
// @ts-ignore
const progress = require('request-progress');
const chalk = require('chalk');
const path = require('path');

// extract datas zip
progress(
  request(
    'https://github.com/paradoxe35/wmb-table/releases/download/v1.0.0/datas.zip'
  )
)
  // @ts-ignore
  .on('progress', function (state) {
    console.log(
      chalk.blueBright.bold('extract data: '),
      state.percent.toFixed(0)
    );
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
    console.log(
      chalk.cyanBright.bold('extract assets data: '),
      state.percent.toFixed(0)
    );
  })
  .pipe(unzipper.Extract({ path: path.resolve(__dirname, '../') }));
