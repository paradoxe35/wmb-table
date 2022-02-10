import { getAssetCredentialsPath } from '@root/sys';
import * as admin from 'firebase-admin';
import * as fireorm from 'fireorm';

const CREDENTIAL_PATH = getAssetCredentialsPath(
  'wmb-table-service_account-credentials.json'
);

/**
 * Initialize fireorem from fire admin admin
 *
 * @returns
 */
export function initializeFireorm() {
  const serviveAccount = require(CREDENTIAL_PATH);

  admin.initializeApp({
    // @ts-ignore
    credential: admin.credential.cert(serviveAccount),
    databaseURL: `https://${serviveAccount.project_id}.firebaseio.com`,
  });

  const firestore = admin.firestore();
  fireorm.initialize(firestore);

  return firestore;
}
