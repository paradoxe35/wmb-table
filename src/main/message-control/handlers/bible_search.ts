import { strNormalizeNoLower } from '@modules/documents/peform-search';
import { BibleBook, BibleSearchResult, SearchMatchersValue } from '@localtypes/index';
import { performSearch } from '@root/utils/functions';
import db, { queryDb } from '@main/db/db';

let searchResults: BibleBook[] = [];
let lastSearch: string;
let pageNumber: number = 1;
const itemsPerPage = 10;

export default async (_: any, text: string, ipageNumber?: number) => {
  const verses = await queryDb.find<BibleBook>(db.bible);

  if (searchResults.length && lastSearch === text) {
    pageNumber = ipageNumber || pageNumber;
  } else {
    pageNumber = 1;
    lastSearch = text;

    searchResults = (verses
      .map((doc: BibleBook, i) => {
        const datas = performSearch<SearchMatchersValue>(
          text,
          strNormalizeNoLower(doc.content)
        );

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
