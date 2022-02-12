import { getAssetCredentialsPath } from '@root/sys';
import fs from 'fs';

const uuidv4: () => string = require('uuid/v4');
const APP_ID_FILE = 'app-id.json';

export function getAppUuid(): { app_id: string } {
  const crendentialPath = getAssetCredentialsPath(APP_ID_FILE);

  if (fs.existsSync(crendentialPath)) {
    return require(crendentialPath);
  }

  const data = { app_id: uuidv4() };

  fs.writeFileSync(crendentialPath, JSON.stringify(data));

  return data;
}
