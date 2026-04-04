import { extname } from 'node:path';
import mammoth from 'mammoth';
import EPub from 'epub';
import { marked } from 'marked';
import {
    extractTextFromPdf,
    serializeParagraphs,
    buildParagraphsFromLines,
} from './pdf-extract.service';
import type { CustomDocumentImportInput, CustomDocumentImportFormat } from '@shared/types';

const MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const TEXT_DECODER = new TextDecoder('utf-8');

const MIME_TO_FORMAT: Record<string, CustomDocumentImportFormat> = {
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/markdown': 'md',
    'text/x-markdown': 'md',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/epub+zip': 'epub',
};

export function resolveCustomDocumentImportFormat(
    fileName: string,
    mimeType?: string | null,
): CustomDocumentImportFormat {
    const normalizedMimeType = mimeType?.trim().toLowerCase();
    if (normalizedMimeType && MIME_TO_FORMAT[normalizedMimeType]) {
        return MIME_TO_FORMAT[normalizedMimeType];
    }

    const extension = extname(fileName).trim().toLowerCase();
    switch (extension) {
        case '.pdf':
            return 'pdf';
        case '.txt':
            return 'txt';
        case '.md':
        case '.markdown':
            return 'md';
        case '.docx':
            return 'docx';
        case '.epub':
            return 'epub';
        default:
            throw new Error('Format de document non pris en charge.');
    }
}

function decodeText(bytes: Uint8Array): string {
    return TEXT_DECODER.decode(bytes).replace(/^\uFEFF/, '');
}

function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#(\d+);/g, (_, code: string) => {
            const value = Number.parseInt(code, 10);
            return Number.isFinite(value) ? String.fromCodePoint(value) : _;
        })
        .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => {
            const value = Number.parseInt(code, 16);
            return Number.isFinite(value) ? String.fromCodePoint(value) : _;
        });
}

export function htmlToParagraphs(html: string): string[] {
    const text = decodeHtmlEntities(
        html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<head[\s\S]*?<\/head>/gi, ' ')
            .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<li\b[^>]*>/gi, '\n- ')
            .replace(/<\/(li|p|div|section|article|blockquote|pre|h[1-6]|tr|table)\s*>/gi, '\n')
            .replace(/<t[dh]\b[^>]*>/gi, '\t')
            .replace(/<\/t[dh]>/gi, '')
            .replace(/<[^>]+>/g, ' '),
    );

    return buildParagraphsFromLines(text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n'));
}

export function extractParagraphsFromPlainText(text: string): string[] {
    return buildParagraphsFromLines(text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n'));
}

async function extractTextFromMarkdown(bytes: Uint8Array): Promise<string> {
    const markdown = decodeText(bytes).replace(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/, '');
    const html = await marked.parse(markdown);
    return serializeParagraphs(htmlToParagraphs(html));
}

async function extractTextFromDocx(bytes: Uint8Array): Promise<string> {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return serializeParagraphs(extractParagraphsFromPlainText(result.value));
}

async function extractTextFromEpub(bytes: Uint8Array): Promise<string> {
    const epub = new EPub(Buffer.from(bytes));
    await epub.parse();

    const paragraphs: string[] = [];
    for (const chapter of epub.flow) {
        const html = await epub.getChapter(chapter.id);
        paragraphs.push(...htmlToParagraphs(html));
    }

    return serializeParagraphs(paragraphs);
}

export async function extractTextFromCustomDocument(
    input: CustomDocumentImportInput,
): Promise<string> {
    if (input.bytes.byteLength > MAX_DOCUMENT_SIZE_BYTES) {
        throw new Error('Le fichier est trop volumineux.');
    }

    const format = resolveCustomDocumentImportFormat(input.fileName, input.mimeType);
    switch (format) {
        case 'pdf':
            return extractTextFromPdf(input.bytes);
        case 'txt':
            return serializeParagraphs(extractParagraphsFromPlainText(decodeText(input.bytes)));
        case 'md':
            return extractTextFromMarkdown(input.bytes);
        case 'docx':
            return extractTextFromDocx(input.bytes);
        case 'epub':
            return extractTextFromEpub(input.bytes);
    }
}
