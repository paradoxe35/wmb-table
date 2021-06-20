import { NoteItemReference } from '../../types';
import db, { queryDb } from '../../utils/main/db';

export default async function references(_: any, noteId: string) {
  const references = await queryDb.find<NoteItemReference>(db.notesReference, {
    noteId,
  });

  return references.sort((a, b) => b.label.localeCompare(a.label));
}

export async function notes_references_store(_: any, noteId: string) {
  const refCount = await queryDb.count(db.notesReference, {
    noteId,
  });

  return await queryDb.insert<NoteItemReference>(db.notesReference, {
    noteId,
    label: `Référence ${refCount + 1}`,
  });
}

export async function notes_references_get(_: any, _id: string) {
  return await queryDb.findOne<NoteItemReference>(db.notesReference, { _id });
}

export async function notes_references_sync(
  _: any,
  noteId: string,
  references: string[]
) {
  const allReference = await queryDb.find<NoteItemReference>(
    db.notesReference,
    { noteId }
  );

  for (const ref of allReference) {
    if (!references.includes(ref._id)) {
      await queryDb.remove(db.notesReference, { _id: ref._id });
    }
  }

  return true;
}

export async function notes_references_put(
  _: any,
  _id: string,
  referenceItem: NoteItemReference
) {
  await queryDb.update(
    db.notesReference,
    { _id },
    { $set: { ...referenceItem } }
  );
  return true;
}
