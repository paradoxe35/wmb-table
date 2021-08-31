import fs from 'fs';
import { promisify } from 'util';
import path from 'path';

const lazy = require('lazy');

export function countFileLines(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    fs.createReadStream(filePath)
      .on('data', (buffer) => {
        let idx = -1;
        lineCount--; // Because the loop will run once for idx=-1
        do {
          //@ts-ignore
          idx = buffer.indexOf(10, idx + 1);
          lineCount++;
        } while (idx !== -1);
      })
      .on('end', () => {
        resolve(lineCount);
      })
      .on('error', reject);
  });
}

export function lastLineOfFile(filePath: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let currentLine: string | Buffer | null = null;
    fs.createReadStream(filePath)
      .on('data', (buffer) => {
        if (buffer) {
          currentLine = buffer;
        }
      })
      .on('end', () => {
        resolve(currentLine ? currentLine.toString() : null);
      })
      .on('error', reject);
  });
}

export function readRangeLinesInFile(
  filename: string,
  start: number
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    let lines: string[] = [];
    const stream = fs.createReadStream(filename);
    lazy(stream)
      .lines.skip(start)
      .map((f: Buffer) => f.toString('utf-8'))
      .forEach((line: string) => lines.push(line));

    stream.on('end', () => resolve(lines));
    stream.on('error', reject);
  });
}

export async function checkForFile(
  fileName: string,
  callback?: (fileName: string) => any
) {
  const exists = promisify(fs.exists);
  const openFile = promisify(fs.open);

  const found = await exists(fileName);
  if (!found) {
    let dir = fileName.split(/[\/\\]/);
    let newDir = dir.slice(0, dir.length - 1).join('/');
    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, {
        recursive: true,
      });
    }
    await openFile(fileName, 'w');
  }
  if (callback) await callback(fileName);
}

/**
 * delete file in directory
 *
 * @param {string} directory
 * @param {string[]} excepts
 */
export function cleanAllFileDir(directory: string, excepts: string[] = []) {
  if (fs.existsSync(directory)) {
    fs.readdir(directory, (err, files) => {
      if (err) {
        console.log(err);
        return;
      }

      for (const file of files) {
        if (!excepts.includes(file)) {
          fs.unlink(path.join(directory, file), (err) => {
            if (err) {
              console.log(err);
              return;
            }
          });
        }
      }
    });
  }
}
