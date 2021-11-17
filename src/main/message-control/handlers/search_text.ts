import { search } from '@main/db/searchable/search';

export default (_: any, text: string, page?: number) => {
  return search(text.trim(), page);
};
