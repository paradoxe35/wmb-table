import { SubjectDocument, SubjectDocumentItem } from '@localtypes/index';
import db, { queryDb } from '@main/db/db';

export default async (_: any, subjectName: string) => {
  return await queryDb.find<SubjectDocument>(
    db.subjectItems,
    {
      subject: subjectName,
    },
    {},
    { createdAt: -1 }
  );
};

export async function subject_items_delete(_: any, id: string) {
  await queryDb.remove<boolean>(db.subjectItems, { _id: id });

  return true;
}

export async function subject_items_store(_: any, item: SubjectDocumentItem) {
  item = await queryDb.insert<SubjectDocumentItem>(db.subjectItems, item);
  return item;
}
