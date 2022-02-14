import { BackupActions } from '@localtypes/index';
import { BaseFirestoreRepository, Collection, getRepository } from 'fireorm';
import { FIRESTORE_INSTANCE } from './constants';
import { AppInstanceParams, SnapshotOnError, SnapshotOnNext } from './type';

// --------- Collections ------------
class HasCollection {
  id!: string;
  created_at!: Date;
  constructor() {
    this.created_at = new Date();
  }
}

@Collection()
export class AppInstance extends HasCollection {
  app_id!: string;
  drive_account_email!: string;
  // this is primary useful to track the last cursor data upte
  data_cursor_count!: number;
  constructor() {
    super();
  }
}

@Collection()
export class DataSync extends HasCollection {
  cursor_counter!: number;
  action!: BackupActions;
  file_drive_id!: string;
  drive_account_email!: string;
  app_instance_id!: string;
  constructor() {
    super();
  }
}

// --------------- collection repositories --------------
export class DataRepository {
  dataRepository: BaseFirestoreRepository<DataSync>;

  constructor() {
    this.dataRepository = getRepository(DataSync);
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
      .whereEqualTo('drive_account_email', email)
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
   * Get all unsynchronized datas
   * @param app_instance
   */
  getUnsynchronizedData(appInstance: AppInstance) {
    return this.dataRepository
      .whereEqualTo('drive_account_email', appInstance.drive_account_email)
      .whereGreaterThan('cursor_counter', appInstance.data_cursor_count)
      .orderByAscending('cursor_counter')
      .find();
  }

  /**
   * Create new data and increment cursor counter peer drive account
   *
   * @param fresh
   * @returns
   */
  async create(fresh: Omit<DataSync, 'cursor_counter' | keyof HasCollection>) {
    const data = new DataSync();

    data.action = fresh.action;
    data.file_drive_id = fresh.file_drive_id;
    data.drive_account_email = fresh.drive_account_email;
    data.app_instance_id = fresh.app_instance_id;

    // increment data cursor from the laster entry
    const ldata = await this.getLatestByAccountEmail(data.drive_account_email);

    /**
     * Get the last cursor counter from Data collection, if there no data yet then set default 1
     * The default must starts from 1, because the app instance should starts from 0
     * so then the verification should use whereGreaterThan instead of whereGreaterOrEqualThan
     */
    data.cursor_counter = !ldata ? 1 : ldata.cursor_counter + 1;

    return this.dataRepository.create(data);
  }

  /**
   * Use to observe any change event on the current drive account email context
   *
   * @param account_email
   * @param onNext
   * @param onError
   * @returns
   */
  onSnapshot(
    account_email: string,
    onNext: SnapshotOnNext,
    onError: SnapshotOnError
  ) {
    return FIRESTORE_INSTANCE.value
      ?.collection(DataSync.name + 's')
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
    return !!(await this.getByEmailAppId({
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
      throw new Error(
        'Try to create an app instance on existing drive account email and app id'
      );
    }

    const instance = new AppInstance();
    instance.app_id = fresh.app_id;
    instance.drive_account_email = fresh.drive_account_email;
    // here get the latest cursor count from data collection
    //
    const dataRepository = new DataRepository();
    const ldata = await dataRepository.getLatestByAccountEmail(
      fresh.drive_account_email
    );

    /**
     * Get the last cursor counter from Data collection, if there no data yet then set default 0
     */
    instance.data_cursor_count = !ldata ? 0 : ldata.cursor_counter;

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
    await this.appInstanceRepository.update(appInstance);
    return appInstance;
  }
}
