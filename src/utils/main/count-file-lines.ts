import fs from 'fs';
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
