import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { documentsTitle, customDocuments } from '../schema';
import type { Title, CustomDocument } from '@shared/types';

export function getAllTitles(): Title[] {
  const rows = getDb().select().from(documentsTitle).all();
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    frTitle: row.frTitle,
    enTitle: row.enTitle,
    traduction: row.traduction,
    web_link: row.webLink,
    pdf_link: row.pdfLink,
    audio_link: row.audioLink,
    date: row.date,
    date_long: row.dateLong,
    other_traductions: row.otherTraductions ? JSON.parse(row.otherTraductions) : [],
  }));
}

export function insertTitle(title: Omit<Title, 'id'>): Title {
  const id = randomUUID();
  getDb()
    .insert(documentsTitle)
    .values({
      id,
      title: title.title,
      frTitle: title.frTitle,
      enTitle: title.enTitle,
      traduction: title.traduction,
      webLink: title.web_link,
      pdfLink: title.pdf_link,
      audioLink: title.audio_link ?? null,
      date: title.date,
      dateLong: title.date_long,
      otherTraductions: JSON.stringify(title.other_traductions ?? []),
    })
    .run();
  return { id, ...title };
}

export function getCustomDocuments(): CustomDocument[] {
  const rows = getDb().select().from(customDocuments).all();
  return rows.map((row) => ({
    id: row.id,
    documentId: row.documentId,
    title: row.title,
    createdAt: new Date(row.createdAt ?? Date.now()),
    updatedAt: new Date(row.updatedAt ?? Date.now()),
  }));
}

export function createCustomDocument(documentId: string, title: string): CustomDocument {
  const id = randomUUID();
  const now = new Date().toISOString();
  getDb()
    .insert(customDocuments)
    .values({ id, documentId, title, createdAt: now, updatedAt: now })
    .run();
  return {
    id,
    documentId,
    title,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
}

export function deleteCustomDocument(id: string): void {
  getDb().delete(customDocuments).where(eq(customDocuments.id, id)).run();
}
