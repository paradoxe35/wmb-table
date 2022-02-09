export const SYNCHRONIZER_UPLOADING: { value: boolean } = {
  value: false,
};

export const SYNCHRONIZER_DOWNLOADING: { value: boolean } = {
  value: false,
};

export const setSynchronizerUploader = (value: boolean) =>
  (SYNCHRONIZER_UPLOADING.value = value);

export const setSynchronizerDownloading = (value: boolean) =>
  (SYNCHRONIZER_DOWNLOADING.value = value);
