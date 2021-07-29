const fs = require('fs-extra');
const path = require('path');

//copy and overwrite original document db
const odatasDir = path.resolve(__dirname, '../datas/');
const datasDir = path.resolve(__dirname, '../assets/datas/');
if (fs.existsSync(odatasDir) && fs.existsSync(datasDir)) {
  fs.copySync(odatasDir, datasDir, { overwrite: true });
}

/**
 * @param {string} directory
 */
function cleanAllFileDir(directory) {
  if (fs.existsSync(directory)) {
    fs.readdir(directory, (err, files) => {
      if (err) {
        console.log(err);
        return;
      }

      for (const file of files) {
        fs.unlink(path.join(directory, file), (err) => {
          if (err) {
            console.log(err);
            return;
          }
        });
      }
    });
  }
}
// clean db files for production
cleanAllFileDir(path.resolve(__dirname, '../assets/datas/db/'));

// clean dist src compiled souces

cleanAllFileDir(path.resolve(__dirname, '../src/dist/'));
