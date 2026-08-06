import { generateText } from 'ai';
import log from '@main/lib/logger';
import * as aiRepo from '@main/database/repositories/ai.repository';
import { resolveActiveModel, resolveLanguageModel } from '@main/services/ai/provider-resolver';
import { resolveProviderBaseUrl } from '@shared/ai.types';
import type { BookChapter, StructuredDocumentContent } from '@shared/types';

/**
 * Optional, off by default, and only ever asked about chapter titles: pages and
 * paragraph boundaries are never sent, so a wrong answer cannot move a citation.
 */

const MAX_PROMPT_BYTES = 32 * 1024;
const MAX_OUTPUT_TOKENS = 4096;
const MAX_TITLE_CHARS = 90;
const CONTEXT_CHARS = 200;

const INSTRUCTIONS = [
    'You are given the titles detected at the top of pages of a scanned book, in order.',
    'For each entry decide whether it opens a chapter of the book, and give its clean title.',
    'Keep the title in the language of the document. Do not translate, invent or reorder.',
    'Reply with JSON only: {"chapters":[{"id":"c1","title":"...","isChapter":true}]}',
].join('\n');

interface ChapterVerdict {
    id?: unknown;
    title?: unknown;
    isChapter?: unknown;
}

export async function refineChapterTitles(
    structure: StructuredDocumentContent,
    abortSignal?: AbortSignal,
): Promise<StructuredDocumentContent> {
    if (structure.chapters.length === 0) return structure;

    try {
        const verdicts = await askModel(buildPrompt(structure), abortSignal);
        if (verdicts.length === 0) return structure;
        return applyVerdicts(structure, verdicts);
    } catch (error) {
        log.warn('Book structure AI refinement skipped', {
            error: error instanceof Error ? error.message : String(error),
        });
        return structure;
    }
}

function buildPrompt(structure: StructuredDocumentContent): string {
    const paragraphAt = new Map(structure.paragraphs.map((entry) => [entry.index, entry]));

    const lines = structure.chapters.map((chapter) => {
        const following = paragraphAt.get(chapter.firstParagraph + 1);
        const context = (following?.text ?? '').slice(0, CONTEXT_CHARS);
        return `${chapter.id} | page ${chapter.page} | ${chapter.title} | next: ${context}`;
    });

    let prompt = `${INSTRUCTIONS}\n\n`;
    for (const line of lines) {
        if (Buffer.byteLength(prompt + line, 'utf8') > MAX_PROMPT_BYTES) break;
        prompt += `${line}\n`;
    }
    return prompt;
}

async function askModel(prompt: string, abortSignal?: AbortSignal): Promise<ChapterVerdict[]> {
    const settings = aiRepo.getSettings();
    const providerId = settings?.activeProvider;
    const modelId = settings ? resolveActiveModel(settings) : null;
    if (!settings?.enabled || !providerId || !modelId) return [];

    const { text } = await generateText({
        model: resolveLanguageModel({
            settings,
            providerId,
            modelId,
            baseUrl: resolveProviderBaseUrl(settings, providerId),
        }),
        prompt,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        abortSignal,
    });

    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    if (!json) return [];

    const parsed: unknown = JSON.parse(json);
    const chapters = (parsed as { chapters?: unknown }).chapters;
    return Array.isArray(chapters) ? (chapters as ChapterVerdict[]) : [];
}

function applyVerdicts(
    structure: StructuredDocumentContent,
    verdicts: ChapterVerdict[],
): StructuredDocumentContent {
    const byId = new Map<string, ChapterVerdict>();
    for (const verdict of verdicts) {
        if (typeof verdict.id === 'string') byId.set(verdict.id, verdict);
    }

    const dropped = new Set<string>();
    const chapters: BookChapter[] = [];
    for (const chapter of structure.chapters) {
        const verdict = byId.get(chapter.id);
        if (verdict?.isChapter === false) {
            dropped.add(chapter.id);
            continue;
        }
        const title =
            typeof verdict?.title === 'string' && verdict.title.trim()
                ? verdict.title.trim().slice(0, MAX_TITLE_CHARS)
                : chapter.title;
        chapters.push({ ...chapter, title });
    }

    if (
        dropped.size === 0 &&
        chapters.every((chapter, index) => chapter.title === structure.chapters[index].title)
    ) {
        return structure;
    }

    // A dropped chapter's paragraphs fold into the one before it.
    const reassigned = new Map<string, string | undefined>();
    let previous: string | undefined;
    for (const chapter of structure.chapters) {
        if (dropped.has(chapter.id)) {
            reassigned.set(chapter.id, previous);
            continue;
        }
        previous = chapter.id;
    }

    return {
        ...structure,
        chapters,
        paragraphs: structure.paragraphs.map((paragraph) => {
            if (!paragraph.chapterId || !dropped.has(paragraph.chapterId)) return paragraph;
            const replacement = reassigned.get(paragraph.chapterId);
            const rest = { ...paragraph };
            delete rest.chapterId;
            return replacement ? { ...rest, chapterId: replacement } : rest;
        }),
        detection: { ...structure.detection, aiAssisted: true },
    };
}
