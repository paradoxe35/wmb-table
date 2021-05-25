import { getAssetPath } from '../../sys';

export default (_: any, filename: string) => {
  return getAssetPath(`datas/documents/${filename}.html`);
};
