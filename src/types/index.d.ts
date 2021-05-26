export type Title = { _id: string; title: string };

export type DataDocument = {
  _id?: string;
  title: string;
  textContent: string;
};

export type DocumentTab = {
  title: string;
  scrollY?: number;
  active: boolean;
};

export type OptionView = {
  search: string | JSX.Element;
  subject: string | JSX.Element;
  history: string | JSX.Element;
};

export type HandlerIPC = (event: Electron.IpcMainEvent, ...args: []) => any;
