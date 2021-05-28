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

export type Suggestions = {
  searchText: string;
  found: number;
};

declare global {
  interface Array<T> {
    paginate: <T>(
      pageNumber: number,
      itemsPerPage: number
    ) => { data: T[]; end: boolean };
  }
}
