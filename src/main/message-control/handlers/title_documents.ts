import { Title } from '@localtypes/index';
import db, { queryDb } from '@main/db/db';

export default async () => {
  const titles = await queryDb.find<Title>(db.documentsTitle);
  return titles || [];
};
