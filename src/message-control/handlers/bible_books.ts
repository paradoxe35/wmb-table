import { BibleBook, BookRequest } from '../../types';
import db, { queryDb } from '../../utils/main/db';

export default async (_: any, request: BookRequest) => {
  return await queryDb.find<BibleBook>(db.bible, request || {});
};
