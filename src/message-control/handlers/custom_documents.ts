import { CustomDocument, DataDocument, UploadDocument } from '../../types';
import db, { queryDb } from '../../utils/main/db';
import fs from 'fs';
import { getAssetPath } from '../../sys';
import { convert } from '../../plugins/main/pdf2html-ex';

export default async () => {
  const datas = await queryDb.find<CustomDocument>(db.customDocuments);
  return (datas || []).sort((a, b) => b.createdAt - a.createdAt);
};

export async function custom_documents_delete(
  _: any,
  document: CustomDocument
) {
  try {
    fs.unlink(getAssetPath(`datas/documents/${document.title}.html`), () => {});
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

  for (const file of documents) {
    const getContent = await convert(file.path, file.name);
    if (getContent) {
      const savedDoc = await queryDb.insert<DataDocument>(
        db.documents,
        getContent
      );

      await queryDb.insert<any>(db.documentsTitle, { title: savedDoc.title });

      const doc = await queryDb.insert<CustomDocument>(db.customDocuments, {
        documentId: savedDoc._id,
        title: savedDoc.title,
      } as CustomDocument);

      docs.push(doc);
    }
  }

  return docs.sort((a, b) => b.createdAt - a.createdAt);
}
