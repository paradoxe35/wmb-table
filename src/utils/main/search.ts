import {
  DataDocument,
  SearchItem,
  SearchMatchersValue,
  SearchResult,
} from '../../types';
import { regexpMatcher, strNormalizeNoLower } from '../functions';
import db, { queryDb } from './db';

let searchResults: SearchItem[] = [];
let lastSearch: string;
let pageNumber: number = 1;
const itemsPerPage = 10;

function performSearch(
  needle: string,
  headstack: string
): SearchMatchersValue[] {
  const terms = strNormalizeNoLower(needle.trim())
    .split(' ')
    .filter(Boolean)
    .join(`[a-z]*([^\s+]*)?`);

  return regexpMatcher(`${terms}[a-z]*`, headstack) as SearchMatchersValue[];
}

export async function search(
  text: string,
  ipageNumber?: number
): Promise<SearchResult> {
  const documents = await queryDb.find<DataDocument>(db.documents);

  if (searchResults.length && lastSearch === text) {
    pageNumber = ipageNumber || pageNumber;
  } else {
    pageNumber = 1;
    lastSearch = text;

    searchResults = documents
      .map((doc: DataDocument, i) => {
        const datas = performSearch(text, doc.textContent);
        return !!datas.length
          ? {
              item: doc,
              matches: datas,
              refIndex: i,
            }
          : undefined;
      })
      .filter(Boolean) as SearchItem[];
  }

  return {
    total: searchResults.length as number,
    pageNumber: pageNumber,
    itemsPerPage,
    query: text,
    ...searchResults.paginate<SearchItem>(pageNumber, itemsPerPage),
  } as SearchResult;
}
