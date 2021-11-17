import { SearchItem, SearchResult } from '@localtypes/index';
import { searchHandler } from './documents';

type Searchable = {
  searchResults: SearchItem[];
  lastSearch: string;
  pageNumber: number;
  itemsPerPage: number;
};

const searchable: Searchable = {
  searchResults: [],
  lastSearch: '',
  pageNumber: 1,
  itemsPerPage: 10,
};

export async function search(
  text: string,
  ipageNumber?: number
): Promise<SearchResult> {
  if (searchable.searchResults.length && searchable.lastSearch === text) {
    searchable.pageNumber = ipageNumber || searchable.pageNumber;
  } else {
    searchable.pageNumber = 1;
    searchable.lastSearch = text;

    searchable.searchResults = await searchHandler(text);
  }

  return {
    total: searchable.searchResults.length as number,
    pageNumber: searchable.pageNumber,
    itemsPerPage: searchable.itemsPerPage,
    query: text,
    ...searchable.searchResults.paginate<SearchItem>(
      searchable.pageNumber,
      searchable.itemsPerPage
    ),
  };
}
