import { AudioDocumentTime, Title } from '@localtypes/index';
import db, { queryDb } from '@main/db/db';
import DownloadableRequest from '@main/features/downloadable-request';
import { getAppHomePath } from '@root/sys';
import { toFilename } from '@root/utils/functions';
import fs from 'fs';
import path from 'path';

export default async (_: any, doc: Title) => {
  const audioTime = await queryDb.findOne<AudioDocumentTime>(
    db.audioDocumentTimes,
    { documentTitle: doc.title }
  );

  // download audio localy
  if (!audioTime?.local_file && doc.audio_link) {
    const homeAudioPath = getAppHomePath('audios');
    const local_file = path.join(homeAudioPath, toFilename(doc.title, 'mp3'));

    const downloadable = new DownloadableRequest(doc.audio_link, local_file);

    downloadable.onEnd(() => {
      queryDb.update(
        db.audioDocumentTimes,
        { documentTitle: doc.title },
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

export async function audio_document_time_set(
  _: any,
  docTitle: string,
  time: number
) {
  await queryDb.update(
    db.audioDocumentTimes,
    { documentTitle: docTitle },
    { $set: { time } },
    { upsert: true }
  );

  db.audioDocumentTimes?.persistence.compactDatafile();

  return true;
}
