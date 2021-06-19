import { Title } from '../../types';
import db, { queryDb } from '../../utils/main/db';

export default async () => {
  const titles = await queryDb.find<Title>(db.documents, {}, { title: 1 });
  return titles || [];
};
