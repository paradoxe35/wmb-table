const fs = require('fs-extra');
const path = require('path');

/**
 * @param {string} directory
 * @param {string[]} excepts
 */
function cleanAllFileDir(directory, excepts = []) {
  if (fs.existsSync(directory)) {
    try {
      const files = fs.readdirSync(directory);
      for (const file of files) {
        if (!excepts.includes(file)) {
          fs.unlinkSync(path.join(directory, file));
        }
      }
    } catch (error) {
      console.log('failed to clean: ', error?.message);
    }
  }
}

//copy and overwrite original document db
const odatasDir = path.resolve(__dirname, '../datas/');
const datasDir = path.resolve(__dirname, '../assets/datas/');
if (fs.existsSync(odatasDir) && fs.existsSync(datasDir)) {
  fs.copySync(odatasDir, datasDir, { overwrite: true });
}

// clean db files for production
cleanAllFileDir(path.resolve(__dirname, '../assets/datas/db/'));

// clean db backup files for production
cleanAllFileDir(path.resolve(__dirname, '../assets/credentials/'), [
  'google-drive-credentials.json',
  '.gitignore',
]);

// clean dist src compiled souces
cleanAllFileDir(path.resolve(__dirname, '../src/dist/'));

// clean db backup files for production
cleanAllFileDir(path.resolve(__dirname, '../assets/datas/backup/'));

// clean db backup pending files
cleanAllFileDir(path.resolve(__dirname, '../assets/datas/backup/pending/'));
