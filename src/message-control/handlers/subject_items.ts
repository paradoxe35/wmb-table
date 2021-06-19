import { SubjectDocument, SubjectDocumentItem } from '../../types';
import db, { queryDb } from '../../utils/main/db';

export default async (_: any, subjectName: string) => {
  const documents = await queryDb.find<SubjectDocument>(db.subjectItems, {
    subject: subjectName,
  });

  return documents;
};

export async function subject_items_delete(_: any, id: string) {
  await queryDb.remove<boolean>(db.subjectItems, { _id: id });

  return true;
}

export async function subject_items_store(_: any, item: SubjectDocumentItem) {
  item = await queryDb.insert<SubjectDocumentItem>(db.subjectItems, item);
  return item;
}
