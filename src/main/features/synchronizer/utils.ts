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

/**
 * Uniquify a loop process
 */
export class UniqueLoopProcess {
  private requesting: boolean = false;
  private timer: NodeJS.Timer | undefined;
  private closed: boolean = false;

  constructor(private INTERVAL: number = 2000) {
    this.unique_loop = this.unique_loop.bind(this);
  }

  // callback function in params
  public loop(callback: () => Promise<void>) {
    this._callback = callback;
    this.timer = setInterval(this.unique_loop, this.INTERVAL);
  }

  private clearInterval() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async _callback() {}

  private async unique_loop() {
    if (this.requesting) {
      this.clearInterval();
      return;
    }
    this.requesting = true;

    await this._callback();

    this.requesting = false;

    if (!this.timer && !this.closed) {
      this.timer = setInterval(this.unique_loop, this.INTERVAL);
    }
  }

  public stop() {
    this.closed = true;
    this.clearInterval();
  }
}
