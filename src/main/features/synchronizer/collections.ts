import { BackupActions } from '@localtypes/index';
import { Collection } from 'fireorm';

@Collection()
export class AppInstance {
  id!: string;
  app_id!: string;
  drive_account!: string;
  update_tracker_count!: number;
  created_at!: Date;
}

@Collection()
export class Data {
  id!: string;
  data_drive_account_counter!: number;
  action!: BackupActions;
  file_drive_id!: string;
  drive_account!: string;
  created_at!: Date;
}
