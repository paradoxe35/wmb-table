export type Title = { _id: string; title: string };

export type DataDocument = {
  _id: string;
  title: string;
  textContent: string;
};

export type DocumentTab = {
  title: string;
  active: boolean;
};
