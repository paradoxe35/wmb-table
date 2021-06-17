import { CustomDocument, DataDocument, UploadDocument } from '../../types';
import db, { queryDb } from '../../utils/main/db';
import fs from 'fs';
import { getAssetPath } from '../../sys';
import { convert } from '../../plugins/main/pdf2html-ex';

export default async () => {
  const datas = await queryDb.find<CustomDocument[]>(db.customDocuments);
  return datas || [];
};

export async function custom_documents_delete(
  _: any,
  document: CustomDocument
) {
  try {
    fs.unlinkSync(getAssetPath(`datas/documents/${document.title}.html`));
    await queryDb.remove<boolean>(db.customDocuments, { _id: document.id });
    await queryDb.remove<boolean>(db.documents, { _id: document.documentId });
  } catch (error) {
    return true;
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

      const doc = await queryDb.insert<CustomDocument>(db.customDocuments, {
        documentId: savedDoc._id,
        title: savedDoc.title,
      } as CustomDocument);

      docs.push(doc);
    }
  }

  return docs;
}
