import { BackupActions } from '@localtypes/index';
import {
  BaseFirestoreRepository,
  Collection,
  getRepository,
  Type,
} from 'fireorm';
import log from 'electron-log';
import { FIRESTORE_INSTANCE } from './constants';
import { AppInstanceParams, SnapshotOnError, SnapshotOnNext } from './type';

// --------- Collections ------------
class HasCollection {
  id!: string;
  created_at!: Date;
}

// fixtures
class FirestoreDocumentReference {
  id!: string;
  path!: string;
}

@Collection()
export class AppInstance extends HasCollection {
  app_id!: string;
  drive_account_email!: string;
  // this is primary useful to track the last cursor data upte
  data_cursor_count!: number;
}

@Collection()
export class Data extends HasCollection {
  cursor_counter!: number;
  action!: BackupActions;
  file_drive_id!: string;
  app_instance_email!: string;
  app_instance_appid!: string;
  @Type(() => FirestoreDocumentReference)
  app_instance_ref?: FirestoreDocumentReference;
}

// --------------- collection repositories --------------
export class DataRepository {
  dataRepository: BaseFirestoreRepository<Data>;

  constructor() {
    this.dataRepository = getRepository(Data);
  }

  get(id: string) {
    return this.dataRepository.findById(id);
  }

  /**
   * Get the last document data in drive account context
   *
   * @param email
   * @returns
   */
  getLatestByAccountEmail(email: string) {
    return this.dataRepository
      .whereEqualTo('app_instance_email', email)
      .orderByDescending('cursor_counter')
      .findOne();
  }

  /**
   * Get firebase document reference of App instance
   *
   * @param appInstanceId
   * @returns
   */
  getAppInstanceRef(appInstanceId: string) {
    return FIRESTORE_INSTANCE.value
      ?.collection(AppInstance.name + 's')
      .doc(appInstanceId);
  }

  /**
   * Create new data and increment cursor counter peer drive account
   *
   * @param fresh
   * @returns
   */
  async create(fresh: Omit<Data, keyof HasCollection>, appInstanceId: string) {
    const data = new Data();

    data.action = fresh.action;
    data.file_drive_id = fresh.file_drive_id;
    data.app_instance_email = fresh.app_instance_email;
    data.app_instance_appid = fresh.app_instance_appid;

    // increment data cursor from the laster entry
    const ldata = await this.getLatestByAccountEmail(data.app_instance_email);

    // increment data cursor
    data.cursor_counter = !ldata ? 1 : ldata.cursor_counter + 1;

    data.app_instance_ref = this.getAppInstanceRef(appInstanceId);

    return this.dataRepository.create(data);
  }

  onSnapshot(
    account_email: string,
    onNext: SnapshotOnNext,
    onError: SnapshotOnError
  ) {
    FIRESTORE_INSTANCE.value
      ?.collection(Data.name + 's')
      .where('drive_account_email', '==', account_email)
      .onSnapshot(onNext, onError);
  }
}

export class AppInstanceRepository {
  appInstanceRepository: BaseFirestoreRepository<AppInstance>;

  constructor() {
    this.appInstanceRepository = getRepository(AppInstance);
  }

  get(id: string) {
    return this.appInstanceRepository.findById(id);
  }

  /**
   * Get app instance from firestore
   *
   * @param param
   * @returns
   */
  getByEmailAppId(param: AppInstanceParams) {
    return this.appInstanceRepository
      .whereEqualTo('app_id', param.app_id)
      .whereEqualTo('drive_account_email', param.drive_account_email)
      .findOne();
  }

  /**
   * Check if whether app instance exist or not
   *
   * @param email
   * @param app_id
   * @returns
   */
  async email_appid_exists(email: string, app_id: string) {
    return !(await this.getByEmailAppId({
      drive_account_email: email,
      app_id,
    }));
  }

  /**
   * Create new app instance, and
   * @param fresh
   * @returns
   */
  async create(fresh: Omit<AppInstance, keyof HasCollection>) {
    const emailExists = await this.email_appid_exists(
      fresh.drive_account_email,
      fresh.app_id
    );
    if (emailExists) {
      log.warn(
        'Try to create an app instance on existing drive account email and app id'
      );
      throw new Error(
        'Try to create an app instance on existing drive account email and app id'
      );
    }

    const instance = new AppInstance();
    instance.app_id = fresh.app_id;
    instance.drive_account_email = fresh.drive_account_email;
    instance.data_cursor_count = 1;

    return await this.appInstanceRepository.create(instance);
  }

  /**
   * Update data cursor every time there's new synchronization (upload or download)
   *
   * @param id
   * @param add
   * @returns
   */
  async update_data_cursor(id: string, add: number = 1) {
    const appInstance = await this.get(id);
    appInstance.data_cursor_count += add;
    return await this.appInstanceRepository.update(appInstance);
  }
}
