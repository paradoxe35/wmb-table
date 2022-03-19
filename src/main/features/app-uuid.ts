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
    return JSON.parse(fs.readFileSync(crendentialPath).toString('utf-8'));
  }

  let cAd = getAppPath()
    .replaceAll('/', '-')
    .replaceAll('\\', '-')
    .replaceAll(' ', '-')
    .trim();

  cAd = cAd.slice(cAd.indexOf('-') + 1, cAd.length);

  const data = { app_id: cAd };

  fs.writeFileSync(crendentialPath, JSON.stringify(data));

  return data;
}
