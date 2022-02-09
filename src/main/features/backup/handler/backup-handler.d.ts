import type { EventEmitter } from 'events';

interface Backuped {
  file_drive_id: string;
  dataJson: any;
  action: 'delete' | 'update' | 'create';
}

export interface Events {
  backup: Backuped;
}

//@ts-ignore
export interface BackupEventEmitter<T> extends EventEmitter {
  on<K extends keyof T>(event: K, listener: (v: T[K]) => void): this;
  emit<K extends keyof T>(event: K, args: T[K]): boolean;
}
