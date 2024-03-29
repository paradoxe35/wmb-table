import { TimeStampData } from '@localtypes/index';

export type SynchronizerAppInstance = {};

export type AppInstanceParams = {
  app_id: string;
  drive_account_email: string;
};

export type SnapshotOnNext = (
  snapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>
) => void;

export type SnapshotOnError = ((error: Error) => void) | undefined;

export type TimeStampType<T> = T & TimeStampData<Date>;
