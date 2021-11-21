import { AudioDocumentTime, Title } from '@localtypes/index';
import db, { queryDb } from '@main/db/db';
import DownloadableRequest from '@main/features/downloadable-request';
import { getAppHomePath } from '@root/sys';
import { getFilename } from '@root/utils/functions';
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

  // download audio localy
  if (
    !audioTime?.local_file &&
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

    // doc.audio_link
    downloadable.onEnd(() => {
      //  remove pending if download succeed
      pending.links = pending.links.filter((link) => link !== doc.audio_link);

      queryDb.update(
        db.audioDocumentTimes,
        { audio_link: doc.audio_link },
        { $set: { local_file } },
        { upsert: true }
      );
    });
  }

  if (audioTime?.local_file && !fs.existsSync(audioTime?.local_file)) {
    audioTime.local_file = undefined;
  }

  if (audioTime)
    return { time: audioTime.time, local_file: audioTime.local_file };

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
