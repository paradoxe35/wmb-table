import { getAppPath, getAssetCredentialsPath } from '@root/sys';
import fs from 'fs';

export const uuidv4: () => string = () => {
  const { v4: uuidv4 } = require('uuid');

  return uuidv4();
};

const APP_ID_FILE = 'app-id.json';

export function getAppUuid(): { app_id: string } {
  const crendentialPath = getAssetCredentialsPath(APP_ID_FILE);

  if (fs.existsSync(crendentialPath)) {
    return require(crendentialPath);
  }

  let cAd = getAppPath()
    .replaceAll('/', '-')
    .replaceAll('\\', '-')
    .replaceAll(' ', '-')
    .trim();

  cAd = cAd.at(0) === '-' ? cAd.slice(1, cAd.length) : cAd;

  const data = { app_id: cAd };

  fs.writeFileSync(crendentialPath, JSON.stringify(data));

  return data;
}
