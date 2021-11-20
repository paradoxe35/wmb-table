import { AudioDocumentTime } from '@localtypes/index';
import db, { queryDb } from '@main/db/db';

export default async (_: any, docTitle: string) => {
  const audioTime = await queryDb.findOne<AudioDocumentTime>(
    db.audioDocumentTimes,
    { documentTitle: docTitle }
  );

  if (audioTime) return audioTime.time;

  return null;
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
