import { SubjectDocument } from '../../types';
import db, { queryDb } from '../../utils/main/db';

export default async (_: any, subject: SubjectDocument | undefined) => {
  const subjects = await queryDb.find<SubjectDocument>(db.subjects);

  if (subject) {
    await queryDb.insert<SubjectDocument>(db.subjects, subject);
    subjects.unshift(subject);
  }

  return subjects.map((subject) => {
    subject.documents = [];
    return subject;
  });
};

export async function subject_document_delete(_: any, subjectName: string) {
  await queryDb.remove<boolean>(db.subjects, { name: subjectName });
  await queryDb.remove<boolean>(
    db.subjectItems,
    { subject: subjectName },
    { multi: true }
  );

  return true;
}
