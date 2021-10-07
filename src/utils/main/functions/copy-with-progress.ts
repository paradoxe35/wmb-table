import fs from 'fs-extra';
//@ts-ignore
import getSizeCallback from 'get-folder-size';

async function getSize(dir: string) {
  return new Promise<number>((resolve, reject) => {
    getSizeCallback(dir, (err: any, size: number | PromiseLike<number>) => {
      if (err) {
        return reject(err);
      }
      resolve(size);
    });
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

const timeInterval = ({
  dest,
  initialSizeDest,
  smoothing,
  sizeSrc,
  onProgress,
  interval,
  move = false,
}: {
  dest: any;
  initialSizeDest: any;
  smoothing: any;
  sizeSrc: any;
  onProgress: any;
  interval: any;
  move?: boolean;
}) => {
  const startTime = Date.now();
  let lastSize = 0;
  let lastTime = startTime;
  let speed = 0;

  const intervalId = setInterval(async () => {
    let sizeDest = (await getSize(dest)) - initialSizeDest;
    if (move) {
      sizeDest = sizeSrc - sizeDest;
    }
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

  return {
    intervalId,
    startTime,
  };
};

export default async function copyWithProgress(
  src: string,
  dest: string,
  {
    onProgress = defaultProgressCallback,
    interval = 1000,
    smoothing = 0.1,
    overwrite = false,
  } = {}
) {
  const sizeSrc = await getSize(src);
  const initialSizeDest = await getSize(dest);

  const { intervalId, startTime } = timeInterval({
    onProgress,
    sizeSrc,
    initialSizeDest,
    smoothing,
    interval,
    dest,
  });

  await fs.copy(src, dest, { overwrite });
  clearInterval(intervalId);

  return millisToSecs(Date.now() - startTime).toFixed(0);
}

export async function moveWithProgress(
  src: string,
  dest: string,
  {
    onProgress = defaultProgressCallback,
    interval = 1000,
    smoothing = 0.1,
    overwrite = false,
  } = {}
) {
  const sizeSrc = await getSize(src);

  const { intervalId, startTime } = timeInterval({
    onProgress,
    sizeSrc,
    initialSizeDest: 0,
    smoothing,
    interval,
    dest: src,
    move: true,
  });

  await fs.move(src, dest, { overwrite });
  clearInterval(intervalId);

  return millisToSecs(Date.now() - startTime).toFixed(0);
}
