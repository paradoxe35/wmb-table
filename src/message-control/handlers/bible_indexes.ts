import fs from 'fs';
import { getAssetBiblePath } from '../../sys';
import { BibleIndex } from '../../types';

export default () => {
  const content = fs
    .readFileSync(getAssetBiblePath('bible-index.json'))
    .toString('utf-8');

  let indexes = JSON.parse(content) as BibleIndex;

  indexes = Object.keys(indexes).reduce((acc, index) => {
    const testament = indexes[index].testament;
    if (!acc[testament]) {
      acc[testament] = {};
    }
    acc[testament][index] = indexes[index];
    return acc;
  }, {} as { [name: string]: any });

  return indexes;
};
