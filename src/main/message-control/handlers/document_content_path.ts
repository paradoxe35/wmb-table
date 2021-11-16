import { getAssetDocumentsPath } from '@root/sys';

export default (_: any, filename: string) => {
  return getAssetDocumentsPath(`${filename}.html`);
};
