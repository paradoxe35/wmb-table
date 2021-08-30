import {
  CustomDocument,
  DataDocument,
  Title,
  UploadDocument,
} from '../../types';
import db, { loadDatabase, queryDb } from '../../utils/main/db';
import fs from 'fs';
import { getAssetDocumentsPath } from '../../sys';
import { convert } from '../../plugins/main/pdf2html-ex';

export default async () => {
  return await queryDb.find<CustomDocument>(
    db.customDocuments,
    {},
    {},
    {
      createdAt: -1,
    }
  );
};

export async function custom_documents_delete(
  _: any,
  document: CustomDocument
) {
  // preload document db to make sur the reste proccess of storing will success
  loadDatabase(db.documents);

  try {
    fs.unlink(getAssetDocumentsPath(`${document.title}.html`), () => {});
    await queryDb.remove<boolean>(db.documents, { _id: document.documentId });
    await queryDb.remove<boolean>(db.customDocuments, { _id: document._id });
    await queryDb.remove<boolean>(db.documentsTitle, { title: document.title });
  } catch (error) {
    return false;
  }
  return true;
}

export async function custom_documents_store(
  _: any,
  documents: UploadDocument[]
) {
  const docs: CustomDocument[] = [];

  // preload document db to make sur the reste proccess of storing will success
  loadDatabase(db.documents);

  for (const file of documents) {
    const getContent = await convert(file.path, file.name);
    if (getContent) {
      const savedDoc = await queryDb.insert<DataDocument>(
        db.documents,
        getContent
      );

      await queryDb.insert<any>(db.documentsTitle, ({
        title: savedDoc.title,
        name: savedDoc.title,
        year: null,
      } as unknown) as Partial<Title>);

      const doc = await queryDb.insert<CustomDocument>(db.customDocuments, {
        documentId: savedDoc._id,
        title: savedDoc.title,
      } as CustomDocument);

      docs.push(doc);
    }
  }

  return docs.sort((a, b) => b.createdAt - a.createdAt);
}
