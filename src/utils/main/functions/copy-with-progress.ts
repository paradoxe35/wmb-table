import fs from 'fs-extra';
import getSizeCallback from 'get-folder-size';

async function getSize(dir: string) {
  return new Promise<number>((resolve, reject) => {
    getSizeCallback(dir)
      .then((data) => {
        resolve(data.size);
      })
      .catch(reject);
  });
}

const bToMB = (val: number) => val / 1024 / 1024;
// const bToGB = (val: number) => (val / 1024 / 1024) * 0.001;
const millisToSecs = (val: number) => val * 0.001;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// function formatTime(secs: number) {
//   if (secs > 60) {
//     const mins = (secs / 60).toFixed(0);
//     const suffix = mins === '1' ? '' : 's';
//     return `${mins} minute${suffix}`;
//   } else {
//     const ssecs = secs.toFixed(0);
//     const suffix = ssecs == '1' ? '' : 's';
//     return `${ssecs} second${suffix}`;
//   }
// }

const defaultProgressCallback = (_data: any) => {};

export default async function copyWithProgress(
  src: string,
  dest: string,
  {
    onProgress = defaultProgressCallback,
    interval = 1000,
    smoothing = 0.1,
  } = {}
) {
  const sizeSrc = await getSize(src);
  const initialSizeDest = await getSize(dest);
  const startTime = Date.now();
  let lastSize = 0;
  let lastTime = startTime;
  let speed = 0;

  const intervalId = setInterval(async () => {
    const sizeDest = (await getSize(dest)) - initialSizeDest;
    const deltaBytes = sizeDest - lastSize;
    if (deltaBytes == 0) return;
    const now = Date.now();
    const deltaTime = now - lastTime;

    const newSpeed = bToMB(deltaBytes) / millisToSecs(deltaTime); //MB/s
    speed = lerp(speed, newSpeed, smoothing);
    const secsPerMB = 1 / speed;
    const remainingMB = bToMB(sizeSrc - sizeDest);
    const remainingSecs = secsPerMB * remainingMB;

    const progress = sizeDest / sizeSrc;

    lastSize = sizeDest;
    lastTime = now;

    onProgress({
      elapsedBytes: sizeDest,
      totalBytes: sizeSrc,
      progress,
      speed,
      remainingSecs,
    });
  }, interval);

  await fs.copy(src, dest, { overwrite: true });
  clearInterval(intervalId);

  return millisToSecs(Date.now() - startTime).toFixed(0);
}
