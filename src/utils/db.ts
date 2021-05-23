import Datastore from 'nedb';

interface Db {
  history?: Datastore | undefined;
  documents?: Datastore | undefined;
  subject?: Datastore | undefined;
}

const db: Db = {};

db.history = new Datastore({
  filename: './assets/datas/history.db',
  autoload: true,
});
db.subject = new Datastore({
  filename: './assets/datas/subject.db',
  autoload: true,
});
db.documents = new Datastore({
  filename: './assets/datas/documents.db',
  autoload: true,
});

export const queryDb = {
  find<T>(
    database: Datastore | undefined,
    fields = {},
    projection = {}
  ): Promise<T[]> {
    if (!database) return Promise.reject(null);
    return new Promise((resolve, reject) => {
      database
        .find(fields)
        .projection(projection)
        .exec(function (err, docs: T[]) {
          if (err) {
            reject(err);
          } else {
            resolve(docs);
          }
        });
    });
  },
};

export default db;
