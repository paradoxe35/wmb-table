import {
  AudioDocumentDownload,
  AudioDocumentTime,
  AudioDownloadProgress,
  Title,
} from '@localtypes/index';
import db, { queryDb } from '@main/db/db';
import DownloadableRequest from '@main/features/downloadable-request';
import { sendIpcToRenderer } from '@root/ipc/ipc-main';
import { getAppHomePath } from '@root/sys';
import { getFilename } from '@root/utils/functions';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import fs from 'fs';
import path from 'path';

const pending: { links: string[] } = {
  links: [],
};
// get audio time and download if not yet downloaded
export default async (_: any, doc: Title) => {
  const audioTime = await queryDb.findOne<AudioDocumentTime>(
    db.audioDocumentTimes,
    { audio_link: doc.audio_link }
  );

  const audioDownload = await queryDb.findOne<AudioDocumentDownload>(
    db.audioDocumentDownloaded,
    { audio_link: doc.audio_link }
  );
  // download audio localy
  if (
    !audioDownload?.local_file &&
    doc.audio_link &&
    !pending.links.includes(doc.audio_link)
  ) {
    const homeAudioPath = getAppHomePath('audios');
    const local_file = path.join(homeAudioPath, getFilename(doc.audio_link));

    pending.links.push(doc.audio_link);

    const downloadable = new DownloadableRequest(doc.audio_link, local_file);

    // if get error in pending download
    downloadable.onError(() => {
      pending.links = pending.links.filter((link) => link !== doc.audio_link);
    });

    // inform client of download progress
    downloadable.onProgress((percentage) => {
      sendIpcToRenderer(IPC_EVENTS.download_audio_progress, {
        document_title: doc.title,
        percentage: percentage,
      } as AudioDownloadProgress);
    });

    // doc.audio_link
    downloadable.onEnd(() => {
      //  remove pending if download succeed
      pending.links = pending.links.filter((link) => link !== doc.audio_link);

      queryDb.update(
        db.audioDocumentDownloaded,
        { audio_link: doc.audio_link },
        { $set: { local_file } },
        { upsert: true }
      );
    });
  }

  if (audioDownload?.local_file && !fs.existsSync(audioDownload?.local_file)) {
    audioDownload.local_file = undefined;
  }

  if (audioTime || audioDownload)
    return {
      time: audioTime?.time ?? 0,
      local_file: audioDownload?.local_file,
    };

  return {};
};
// update audio time
export async function audio_document_time_set(
  _: any,
  audio_link: string,
  time: number
) {
  await queryDb.update(
    db.audioDocumentTimes,
    { audio_link },
    { $set: { time } },
    { upsert: true }
  );

  db.audioDocumentTimes?.persistence.compactDatafile();

  return true;
}

export async function audio_document_last_play(_: any, doc: Title | undefined) {
  const query = { reference: 'audio-play' };
  if (doc) {
    await queryDb.update(
      db.audioDocumentLastPlay,
      query,
      { $set: { doc } },
      { upsert: true }
    );
    db.audioDocumentLastPlay?.persistence.compactDatafile();
  } else {
    return (await queryDb.findOne<any>(db.audioDocumentLastPlay, query))?.doc;
  }
}
