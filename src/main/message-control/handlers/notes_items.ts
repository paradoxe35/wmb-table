import { NoteItem } from '@localtypes/index';
import { capitalizeFirstLetter } from '@root/utils/functions';
import db, { queryDb } from '@main/db/db';

export default async (_: any) => {
  await queryDb.remove(
    db.notes,
    {
      $where: function () {
        // @ts-ignore
        return (this.content || '').trim().length < 2;
      },
    },
    { multi: true }
  );

  return await queryDb.find<NoteItem>(
    db.notes,
    {},
    { content: 0 },
    { createdAt: -1 }
  );
};

export async function notes_items_delete(_: any, _id: string) {
  await queryDb.remove(db.notes, { _id });
  await queryDb.remove(db.notesReference, { noteId: _id }, { multi: true });
  return true;
}

export async function notes_items_get(_: any, _id: string) {
  const note = await queryDb.findOne<NoteItem>(db.notes, { _id });
  if (note?.created) {
    await queryDb.update(db.notes, { _id }, { $set: { created: false } });
  }
  return note;
}

export async function notes_items_store() {
  const notes = await queryDb.count(db.notes, { defaultName: true });
  return await queryDb.insert(db.notes, {
    name: `Note ${notes + 1}`,
    defaultName: true,
    created: true,
  } as NoteItem);
}

export async function notes_items_rename(_: any, _id: string, newName: string) {
  const titles = (await queryDb.find<NoteItem>(db.notes, {}, { name: 1 }))
    .filter((n) => n._id !== _id)
    .map((d) => d.name);

  if (titles.includes(newName) || newName.trim().length < 3) {
    return false;
  }

  await queryDb.update(
    db.notes,
    { _id },
    { $set: { name: capitalizeFirstLetter(newName), defaultName: false } }
  );

  return newName;
}

export async function notes_items_update_content(
  _: any,
  _id: string,
  content: string
) {
  await queryDb.update(db.notes, { _id }, { $set: { content } });
  return true;
}
