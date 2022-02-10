import { BackupActions } from '@localtypes/index';
import type { EventEmitter } from 'events';

export interface BackedUp {
  file_drive_id: string;
  dataJson: any;
  action: BackupActions;
}

export interface Events {
  backup: BackedUp;
}

//@ts-ignore
export interface BackupEventEmitter<T> extends EventEmitter {
  on<K extends keyof T>(event: K, listener: (v: T[K]) => void): this;
  emit<K extends keyof T>(event: K, args: T[K]): boolean;
}
