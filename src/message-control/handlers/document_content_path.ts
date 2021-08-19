import { getAssetDocumentsPath } from '../../sys';

export default (_: any, filename: string) => {
  return getAssetDocumentsPath(`${filename}.html`);
};
