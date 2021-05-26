import flexsearch from 'flexsearch';
import { DataDocument } from '../../types';
import db, { queryDb } from './db';

export const indexDataDocument = flexsearch.create<DataDocument[]>({
  async: true,
  cache: true,
  profile: 'match',
});

export async function indexFlexSearchDocuments() {
  const documents = await queryDb.find<DataDocument>(db.documents, {});
  const docs = documents.map((doc, id) => ({
    id,
    title: doc.title,
    textContent: doc.textContent,
  }));
  indexDataDocument.add(docs);
}
