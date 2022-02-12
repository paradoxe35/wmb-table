const fs = require('fs-extra');
const path = require('path');
//@ts-ignore
const nedb = require('../src/node_modules/@seald-io/nedb');
const chalk = require('chalk');

/**
 * @param {string} directory
 * @param {string[]} excepts
 * @param {boolean} removeDir
 * @param {string[]} extensions
 */
function cleanAllFileDir(
  directory,
  excepts = ['.gitignore'],
  removeDir = false,
  extensions = []
) {
  if (!excepts.includes('.gitignore')) {
    excepts.push('.gitignore');
  }

  if (fs.existsSync(directory)) {
    try {
      if (removeDir) {
        fs.rm(directory, { recursive: true, force: true });
        return;
      }
      const files = fs.readdirSync(directory);
      for (const file of files) {
        if (
          !excepts.includes(file) &&
          (extensions.length === 0 ||
            // @ts-ignore
            extensions.includes('.' + file.split('.').pop()))
        ) {
          fs.unlinkSync(path.join(directory, file));
        }
      }
    } catch (error) {
      console.log('failed to clean: ', error?.message || error);
    }
  }
}

//copy and overwrite original document db
const odatasDir = path.resolve(__dirname, '../datas/');
const datasDir = path.resolve(__dirname, '../assets/datas/');
const docHtml = path.resolve(datasDir, 'documents/');

if (fs.existsSync(odatasDir) && fs.existsSync(datasDir)) {
  fs.copySync(odatasDir, datasDir, { overwrite: true });
}

async function removeHtmlFiles() {
  const docTitles = path.resolve(odatasDir, 'documents-db/documents-title.db');

  if (!fs.existsSync(docTitles) || !fs.existsSync(docHtml)) {
    return;
  }

  const filesDocs = fs.readdirSync(docHtml).filter((f) => f.endsWith('.html'));

  /** @type {string[]} */
  const filesTitle = await new Promise((resolve, reject) => {
    const db = new nedb({
      filename: docTitles,
    });

    db.loadDatabase();

    db.find({}, (/** @type {any} */ err, /** @type {any} */ data) => {
      if (err) return reject(err);
      resolve(
        data.map((/** @type {{ title: any; }} */ f) => `${f.title}.html`)
      );
    });
  });

  filesDocs.forEach((file) => {
    if (!filesTitle.includes(file)) {
      fs.unlinkSync(path.join(docHtml, file));
    }
  });
}

// clean db files for production
cleanAllFileDir(path.resolve(datasDir, 'db/'));

const credentialsPath = path.resolve(datasDir, 'credentials/');
const credentialsFiles = [
  'google-drive-credentials.json',
  'wmb-table-service_account-credentials.json',
];
// clean db backup files for production
cleanAllFileDir(credentialsPath, credentialsFiles);

// warn if google-drive-credentials.json doent exist
for (const credentialsFile of credentialsFiles) {
  if (!fs.existsSync(path.resolve(credentialsPath, credentialsFile))) {
    console.log(`\n
      -------------------- ${chalk.redBright.bold(
        'Cannot find file: ' + credentialsFile
      )} -----------------------
    `);
    process.exit(1);
  }
}

// warn if documents dir doent exist
if (!fs.existsSync(path.resolve(datasDir, 'documents/'))) {
  console.log(`\n
    -------------------- ${chalk.redBright.bold(
      'Cannot find documents directory'
    )} -----------------------
  `);
}

// warn if documents-db dir doent exist
if (!fs.existsSync(path.resolve(datasDir, 'documents-db/'))) {
  console.log(`\n
    -------------------- ${chalk.redBright.bold(
      'Cannot find documents-db directory'
    )} -----------------------
  `);
}

// warn if bible dir doent exist
if (!fs.existsSync(path.resolve(datasDir, 'bible/'))) {
  console.log(`\n
    -------------------- ${chalk.redBright.bold(
      'Cannot find bible directory'
    )} -----------------------
  `);
}

// clean dist src compiled souces
cleanAllFileDir(path.resolve(__dirname, '../src/dist/'));

// clean db backup files for production
cleanAllFileDir(path.resolve(datasDir, 'backup/pending'));

cleanAllFileDir(path.resolve(datasDir, 'backup/'), ['pending']);

if (process.argv.includes('--force')) {
  console.log('remove document html: --force');
  removeHtmlFiles();
  // js file document html file
  cleanAllFileDir(docHtml, [], false, ['.js']);
}
