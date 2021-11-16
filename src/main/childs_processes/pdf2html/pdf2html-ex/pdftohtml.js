const { spawn } = require('child_process');

/**
 * @param {any} filename
 * @param {null} outfile
 * @param {{}} options
 */
function pdftohtml(filename, outfile, options) {
  this.options = options || {};
  // @ts-ignore
  this.options.additional = [filename];

  if (typeof outfile !== 'undefined' && outfile !== null) {
    // @ts-ignore
    this.options.additional.push('--dest-dir', outfile);
  }

  pdftohtml.prototype._preset = (/** @type {string} */ preset) => {
    let module;

    try {
      module = require(`./presets/${preset}`);
    } catch (error) {
      module = require(preset);
    } finally {
      if (module && typeof module.load === 'function') {
        module.load(this);
        return this;
      } else {
        throw new Error('preset ' + preset + ' could not be loaded');
      }
    }
  };

  pdftohtml.prototype.add_options = (/** @type {any[]} */ optionArray) => {
    if (typeof optionArray.length !== undefined) {
      const self = this;

      optionArray.forEach((el) => {
        const firstSpace = el.indexOf(' ');
        if (firstSpace > 0) {
          const param = el.substr(0, firstSpace);
          const val = el.substr(firstSpace + 1).replace(/ /g, '\\ ');
          // @ts-ignore
          self.options.additional.push(param, val);
        } else {
          // @ts-ignore
          self.options.additional.push(el);
        }
      });
    }
    return this;
  };

  pdftohtml.prototype.convert = (/** @type {string} */ preset) => {
    const presetFile = preset || 'default';
    const self = this;

    // @ts-ignore
    self.options.bin = process.env.ASSETS_PATH + '/pdf2html-ex/pdf2htmlEX.exe';

    return new Promise((resolve, reject) => {
      let error = '';

      // @ts-ignore
      self._preset(presetFile);

      // @ts-ignore
      const child = spawn(self.options.bin, self.options.additional);

      child.stdout.on('data', (_data) => {
        // pdf2htmlEX writes out to stderr
      });

      child.stderr.on('data', (data) => {
        error += data;

        if (
          // @ts-ignore
          self.options.progress &&
          // @ts-ignore
          typeof self.options.progress === 'function'
        ) {
          //@ts-ignore
          const lastLine = data.toString('utf8').split(/\r\n|\r|\n/g);
          const ll = lastLine[lastLine.length - 2];
          let progress;

          if (ll) {
            progress = ll.split(/Working\: ([0-9\d]+)\/([0-9\d]+)/gi);
          }

          if (progress && progress.length > 1) {
            // build progress report object
            const ret = {
              current: parseInt(progress[1]),
              total: parseInt(progress[2]),
            };
            // @ts-ignore
            self.options.progress(ret);
          }
        }
      });

      child.on('error', (_err) => {
        const error = new Error(
          'Please install pdf2htmlEX from https://github.com/coolwanglu/pdf2htmlEX'
        );
        error.name = 'ExecutableError';

        reject(error);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(error);
        } else {
          reject(
            new Error(
              `${
                // @ts-ignore
                self.options.bin
                // @ts-ignore
              } ran with parameters: ${self.options.additional.join(
                ' '
              )} exited with an error code ${code} with following error:\n${error}`
            )
          );
        }
      });
    });
  };

  pdftohtml.prototype.progress = (/** @type {any} */ callback) => {
    // @ts-ignore
    this.options.progress = callback;
    return this;
  };
}

// module exports
module.exports = function (
  /** @type {string} */ filename,
  /** @type {null} */ outfile,
  /** @type {{}} */ options
) {
  return new pdftohtml(filename, outfile, options);
};
