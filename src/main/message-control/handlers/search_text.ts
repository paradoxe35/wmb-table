import { search } from '@main/db/search';

export default (_: any, text: string, page?: number) => {
  return search(text.trim(), page);
};
