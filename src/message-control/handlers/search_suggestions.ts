import { Suggestions } from '../../types';
import db, { queryDb } from '../../utils/main/db';

export default async (
  _: Electron.IpcMainEvent,
  suggs: Suggestions | undefined
) => {
  let suggestions = await queryDb.find<Suggestions>(db.suggestions);
  let newSuggestions = [];

  if (suggs) {
    newSuggestions = suggestions.filter(
      (r) => r.searchText != suggs.searchText
    );
  } else {
    newSuggestions = suggestions;
  }

  if (suggs && suggestions.length + 1 > 20) {
    await queryDb.remove(db.suggestions, {}, { multi: true });
    await queryDb.insert(
      db.suggestions,
      [suggs, ...newSuggestions].slice(0, 20)
    );
  } else if (suggs) {
    if (!suggestions.some((r) => r.searchText == suggs.searchText)) {
      await queryDb.insert(db.suggestions, suggs);
    }
  }

  return [...(suggs ? [suggs] : []), ...newSuggestions];
};
