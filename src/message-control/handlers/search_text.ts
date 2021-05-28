import { search } from '../../utils/main/fuse';

export default (_: any, text: string) => {
  return search(text.trim());
};
