import { BibleBook, NoteItemReferenceBible } from '../../types';
import db, { queryDb } from '../../utils/main/db';

export async function notes_references_bible_store(_: any, noteId: string) {
  const refCount = await queryDb.count(db.notesBibleReference, {
    noteId,
  });

  return await queryDb.insert<NoteItemReferenceBible>(db.notesBibleReference, {
    noteId,
    label: `Référence ${refCount + 1}`,
    references: [],
  });
}

export async function notes_references_bible_sync(
  _: any,
  noteId: string,
  references: string[]
) {
  const allReference = await queryDb.find<NoteItemReferenceBible>(
    db.notesBibleReference,
    { noteId }
  );

  for (const ref of allReference) {
    if (!references.includes(ref._id)) {
      await queryDb.remove(db.notesBibleReference, { _id: ref._id });
    }
  }

  return true;
}

export async function notes_references_bible_get(_: any, _id: string) {
  const datas = await queryDb.findOne<NoteItemReferenceBible>(
    db.notesBibleReference,
    { _id }
  );

  if (!datas) return null;

  const ids = datas.references as string[];
  const refs = [] as BibleBook[];

  for (const id of ids) {
    const ref = await queryDb.findOne<BibleBook>(db.bible, { _id: id });
    ref && refs.push(ref);
  }

  datas.references = refs;

  return datas;
}

export async function notes_references_bible_add(
  _: any,
  _id: string,
  bibleId: string
) {
  const verse = await queryDb.findOne<BibleBook>(db.bible, { _id: bibleId });

  if (verse) {
    await queryDb.update(
      db.notesBibleReference,
      { _id },
      { $addToSet: { references: bibleId } }
    );
  }

  return verse;
}

export async function notes_references_bible_remove(
  _: any,
  _id: string,
  bibleId: string
) {
  const verse = await queryDb.findOne<BibleBook>(db.bible, { _id: bibleId });

  if (verse) {
    await queryDb.update(
      db.notesBibleReference,
      { _id },
      { $pull: { references: bibleId } }
    );
  }

  return true;
}
