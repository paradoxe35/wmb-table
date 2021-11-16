import { BibleBook, BookRequest } from '@localtypes/index';
import db, { queryDb } from '@main/db/db';

export default async (_: any, request: BookRequest) => {
  return await queryDb.find<BibleBook>(db.bible, request || {});
};
