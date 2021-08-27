export let DATA_RESTORED: boolean | null = false;
export let DATA_RESTORING: boolean = false;

export const setDataRestored = (value: boolean | null) =>
  (DATA_RESTORED = value);

export const setDataRestoring = (value: boolean) => (DATA_RESTORING = value);
