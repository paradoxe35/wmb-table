import { search } from '../../utils/main/search';

export default (_: any, text: string, page?: number) => {
  return search(text.trim(), page);
};
