import { Title } from '@localtypes/index';

export default class DocumentTitle {
  constructor(private doc: Title) {}

  getName() {
    return this.doc.frTitle;
  }

  getYear<T = string | null>(): T {
    const value = this.doc.date ? '19' + this.doc.date.split('-')[0] : null;
    return (value as unknown) as T;
  }

  getId() {
    return this.doc._id;
  }

  getTitle() {
    return this.doc.title;
  }

  toObject() {
    return this.doc;
  }
}
