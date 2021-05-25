import { Title } from '../../types';
import db, { queryDb } from '../../utils/db';

export default async () => {
  return await queryDb.find<Title>(db.documents, {}, { title: 1 });
};
