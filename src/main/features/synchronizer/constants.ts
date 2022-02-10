import * as admin from 'firebase-admin';

export const SYNCHRONIZER_UPLOADING: { value: boolean } = {
  value: false,
};

export const FIRESTORE_INSTANCE: { value: admin.firestore.Firestore | null } = {
  value: null,
};

export const SYNCHRONIZER_DOWNLOADING: { value: boolean } = {
  value: false,
};

export const setFirestoreInstance = (value: admin.firestore.Firestore) =>
  (FIRESTORE_INSTANCE.value = value);

export const setSynchronizerUploader = (value: boolean) =>
  (SYNCHRONIZER_UPLOADING.value = value);

export const setSynchronizerDownloading = (value: boolean) =>
  (SYNCHRONIZER_DOWNLOADING.value = value);
