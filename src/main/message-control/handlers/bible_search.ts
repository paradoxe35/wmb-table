import { BibleBook, BibleSearchResult } from '@localtypes/index';
import db, { queryDb } from '@main/db/db';
import { performSearch, strNormalizeNoLower } from '@modules/shared/searchable';

let searchResults: BibleBook[] = [];
let lastSearch: string;
let pageNumber: number = 1;
let lastTestament: string | undefined = undefined;
const itemsPerPage = 10;

export default async (
  _: any,
  text: string,
  ipageNumber?: number,
  testament?: string
) => {
  if (
    searchResults.length &&
    lastSearch === text &&
    lastTestament === testament
  ) {
    pageNumber = ipageNumber || pageNumber;
  } else {
    const verses = await queryDb.find<BibleBook>(db.bible);

    lastTestament = testament;

    pageNumber = 1;
    lastSearch = text;

    searchResults = (verses
      .filter((t) => (testament ? t.testament === testament : true))
      .map((doc: BibleBook, i) => {
        const datas = performSearch(text, strNormalizeNoLower(doc.content));

        return !!datas.length
          ? {
              item: doc,
              matches: datas,
              refIndex: i,
            }
          : undefined;
      })
      .filter(Boolean) as unknown) as BibleBook[];
  }

  return ({
    total: searchResults.length as number,
    pageNumber: pageNumber,
    itemsPerPage,
    query: text,
    ...searchResults.paginate<BibleBook>(pageNumber, itemsPerPage),
  } as unknown) as BibleSearchResult;
};
