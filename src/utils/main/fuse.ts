import { DataDocument } from '../../types';
import db, { queryDb } from './db';
import Fuse from 'fuse.js';
import { getAssetPath } from '../../sys';

export let fuseSearch: Fuse<any>;

let searchResults: any[] = [];
let lastSearch: string;
let pageNumber: number = 0;

export async function indexSearchDocuments() {
  const documents = await queryDb.find<DataDocument>(db.documents, {});

  const fuseIndex = await require(getAssetPath('datas/documents-index.json'));
  const myIndex = Fuse.parseIndex(fuseIndex);

  fuseSearch = new Fuse(
    documents,
    {
      includeScore: true,
      useExtendedSearch: true,
      includeMatches: true,
      keys: ['textContent'],
    },
    myIndex
  );
}

export function search<T>(text: string) {
  if (searchResults.length && lastSearch === text) {
    pageNumber = pageNumber + 1;
  } else {
    pageNumber = 0;
    lastSearch = text;
    searchResults = fuseSearch.search(text);
  }

  return {
    total: searchResults.length as number,
    pageNumber: pageNumber,
    itemsPerPage: 10,
    ...searchResults.paginate<T>(pageNumber, 10),
  };
}
