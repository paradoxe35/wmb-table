import {
    CANONICAL_BOOK_COUNT,
    CANONICAL_CHAPTER_COUNT,
    GETBIBLE_BASE_URL,
    HELLOAO_BASE_URL,
    USER_AGENT,
} from './config.mjs';
import { buildHelloaoChapterVerses } from './content.mjs';
import { createHash } from 'node:crypto';

const GETBIBLE_AVAILABILITY_CACHE = new Map();

const isOT = (number) => number >= 1 && number <= 39;

function fetchJson(url) {
    return fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(60_000),
    }).then(async (response) => {
        if (!response.ok) {
            return null;
        }
        return response.json();
    });
}

function buildVerseId(sourceVersionId, book, chapter, verse) {
    return createHash('sha256')
        .update(`${sourceVersionId}:${book}:${chapter}:${verse}`)
        .digest('base64url')
        .slice(0, 16);
}

function bookCode(bookNumber) {
    return `${String(bookNumber).padStart(2, '0')}${isOT(bookNumber) ? 'O' : 'N'}`;
}

function canonicalBookNumbers(numbers) {
    return numbers.filter((number) => Number.isInteger(number) && number >= 1 && number <= 66);
}

export async function fetchHelloaoTranslationCatalog() {
    const data = await fetchJson(`${HELLOAO_BASE_URL}/available_translations.json`);
    return data?.translations ?? [];
}

export async function getGetBibleAvailability(versionId) {
    if (GETBIBLE_AVAILABILITY_CACHE.has(versionId)) {
        return GETBIBLE_AVAILABILITY_CACHE.get(versionId);
    }

    const books = await fetchJson(`${GETBIBLE_BASE_URL}/${versionId}/books.json`);
    if (!books) {
        GETBIBLE_AVAILABILITY_CACHE.set(versionId, null);
        return null;
    }

    const canonicalNumbers = canonicalBookNumbers(
        Object.keys(books)
            .map(Number)
            .sort((left, right) => left - right),
    );
    const allBookNumbers = Object.keys(books)
        .map(Number)
        .filter((number) => Number.isInteger(number) && number > 0)
        .sort((left, right) => left - right);
    const isCanonicalComplete =
        canonicalNumbers.length === CANONICAL_BOOK_COUNT &&
        canonicalNumbers.every((number, index) => number === index + 1);
    const result = {
        versionId,
        allBookNumbers,
        canonicalBookNumbers,
        isCanonicalComplete,
    };
    GETBIBLE_AVAILABILITY_CACHE.set(versionId, result);
    return result;
}

export function isHelloaoTranslationComplete(translation) {
    return (
        translation &&
        translation.numberOfBooks === CANONICAL_BOOK_COUNT &&
        translation.totalNumberOfChapters === CANONICAL_CHAPTER_COUNT &&
        translation.availableFormats?.includes('json')
    );
}

function getGetBibleBookNumbers(books) {
    return (books ?? [])
        .map((book) => Number(book?.nr))
        .filter((number) => Number.isInteger(number) && number > 0)
        .sort((left, right) => left - right);
}

export function buildGetBibleRowsFromBooks(books, sourceVersionId) {
    const verseRows = [];
    const chapterRows = [];

    for (const book of books ?? []) {
        const bookNumber = Number(book?.nr);
        if (!Number.isInteger(bookNumber) || bookNumber <= 0) {
            continue;
        }

        const code = bookCode(bookNumber);
        const testament = isOT(bookNumber) ? 'O' : 'N';

        for (const chapterData of book.chapters ?? []) {
            const chapter = String(chapterData.chapter);
            chapterRows.push({
                bookName: book.name,
                book: code,
                chapter,
                contentJson: null,
                footnotesJson: null,
                audioLinksJson: null,
            });

            for (const verseData of chapterData.verses ?? []) {
                const verse = String(verseData.verse);
                const content = (verseData.text ?? '').trim();
                if (!content) {
                    continue;
                }

                verseRows.push({
                    id: buildVerseId(sourceVersionId, code, chapter, verse),
                    bookName: book.name,
                    book: code,
                    testament,
                    chapter,
                    verse,
                    content,
                });
            }
        }
    }

    return { verseRows, chapterRows };
}

export async function fetchGetBibleVersionData(config) {
    const fullTranslation = await fetchJson(`${GETBIBLE_BASE_URL}/${config.sourceVersionId}.json`);
    if (Array.isArray(fullTranslation?.books)) {
        const canonicalNumbers = canonicalBookNumbers(
            getGetBibleBookNumbers(fullTranslation.books),
        );
        const isCanonicalComplete =
            canonicalNumbers.length === CANONICAL_BOOK_COUNT &&
            canonicalNumbers.every((number, index) => number === index + 1);

        if (!isCanonicalComplete) {
            return null;
        }

        return buildGetBibleRowsFromBooks(fullTranslation.books, config.sourceVersionId);
    }

    const availability = await getGetBibleAvailability(config.sourceVersionId);
    if (!availability?.isCanonicalComplete) {
        return null;
    }

    const books = [];

    for (const bookNumber of availability.allBookNumbers) {
        const book = await fetchJson(
            `${GETBIBLE_BASE_URL}/${config.sourceVersionId}/${bookNumber}.json`,
        );
        if (!book) {
            return null;
        }
        books.push(book);
    }

    return buildGetBibleRowsFromBooks(books, config.sourceVersionId);
}

export async function fetchHelloaoVersionData(config) {
    const translation = await fetchJson(
        `${HELLOAO_BASE_URL}/${config.sourceVersionId}/complete.json`,
    );
    if (!translation?.translation || !Array.isArray(translation.books)) {
        return null;
    }

    if (!isHelloaoTranslationComplete(translation.translation)) {
        return null;
    }

    const verseRows = [];
    const chapterRows = [];

    for (const book of translation.books) {
        if (book.isApocryphal || book.order < 1 || book.order > 66) {
            continue;
        }

        const code = bookCode(book.order);
        const testament = isOT(book.order) ? 'O' : 'N';

        for (const chapterData of book.chapters ?? []) {
            const chapter = String(chapterData.chapter?.number ?? '');
            if (!chapter) {
                continue;
            }

            chapterRows.push({
                bookName: book.name,
                book: code,
                chapter,
                contentJson: JSON.stringify(chapterData.chapter?.content ?? []),
                footnotesJson: JSON.stringify(chapterData.chapter?.footnotes ?? []),
                audioLinksJson: JSON.stringify(chapterData.thisChapterAudioLinks ?? {}),
            });

            const chapterVerses = buildHelloaoChapterVerses(
                chapterData.chapter?.content ?? [],
                chapterData.chapter?.footnotes ?? [],
            );

            for (const chapterVerse of chapterVerses) {
                verseRows.push({
                    id: buildVerseId(config.sourceVersionId, code, chapter, chapterVerse.verse),
                    bookName: book.name,
                    book: code,
                    testament,
                    chapter,
                    verse: chapterVerse.verse,
                    content: chapterVerse.content,
                    footnotesJson:
                        chapterVerse.footnotes.length > 0
                            ? JSON.stringify(chapterVerse.footnotes)
                            : null,
                });
            }
        }
    }

    return { verseRows, chapterRows };
}

export async function fetchBibleDataForResolvedVersion(config) {
    if (config.source === 'getbible') {
        return fetchGetBibleVersionData(config);
    }

    if (config.source === 'helloao') {
        return fetchHelloaoVersionData(config);
    }

    throw new Error(`Unsupported source "${config.source}"`);
}
