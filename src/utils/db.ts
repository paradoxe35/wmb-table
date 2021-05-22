import Datastore from 'nedb';

interface Db {
  history?: Datastore;
  documents?: Datastore;
  subject?: Datastore;
}

const db: Db = {};

db.history = new Datastore('../../assets/datas/history.db');
db.subject = new Datastore('../../assets/datas/subject.db');
db.documents = new Datastore('../../assets/datas/documents.db');

export default db;
