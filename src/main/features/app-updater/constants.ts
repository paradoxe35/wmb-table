type Value<T = boolean | null> = { value: T };

export let UPDATER_RESTORING_DATA: Value<boolean> = {
  value: false,
};

export const setUpdaterRestoringData = (value: boolean) =>
  (UPDATER_RESTORING_DATA.value = value);
