import { Suggestions } from '../../types';
import db, { queryDb } from '../../utils/main/db';

export default async (
  _: Electron.IpcMainEvent,
  suggs: Suggestions | undefined
) => {
  const suggestions = await queryDb.find<Suggestions>(db.suggestions);

  if (suggestions.length && suggs && suggestions.length + 1 > 20) {
    await queryDb.remove(db.suggestions, {}, { multi: true });
    await queryDb.insert(db.suggestions, [...suggestions, suggs]);
  } else if (suggs) {
    await queryDb.insert(db.suggestions, suggs);
  }

  return suggestions;
};
