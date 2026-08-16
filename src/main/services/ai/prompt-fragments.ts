/** Applies the "never interpret" rule to the two cases it does not cover on its own. */
export const SHARED_FAITHFULNESS_PROMPT_LINES = [
    'If sources appear to differ, give each one with its own context rather than reconciling them. Say plainly that they differ instead of deciding which is right.',
    'Say when a sermon was preached whenever it bears on the answer, such as comparing what was said in different years. Keep the date in your own sentence, not inside the link label.',
];

export const SHARED_SERMON_REFERENCE_PROMPT_LINES = [
    '### Sermon references',
    'Format: `[Title, §N](wmb://sermon/{sermonId}/{languageCode}/{translationId}/{paragraphNumber})`',
    'Example: if meta.sermonId="56-0805", meta.languageCode="fr", meta.translationId=3, paragraphNumber=45:',
    "→ `[L'Église et sa condition, §45](wmb://sermon/56-0805/fr/3/45)`",
    'For paragraph ranges, keep the range in the label but link to the first exact paragraph returned by the tool. Example: `[Le Premier Sceau, §157-160](wmb://sermon/63-0318/fr/1/157)`.',
    'The visible link label should use the human-readable sermon title from tool results, not the sermonId. Good: `[Le Dieu de cet âge mauvais, §133](...)`. Bad: `[65-0801M, §133](...)` when the title is available.',
    'Use the sermonId only inside the `wmb://` URL, or in visible text when the title is unavailable or extra disambiguation is genuinely needed.',
    'In prose and summaries, do not leave standalone raw sermon IDs like `62-0318` or `63-0728` when the title is available from tool results.',
];

export const SHARED_BIBLE_REFERENCE_PROMPT_LINES = [
    '### Bible references',
    'Format: `[BookName Chapter:Verse](wmb://bible/{bookCode}/{chapter}/{verse}/{bibleVersionAbbreviation}/{bookName})`',
    'Examples: `[Josue 1:9](wmb://bible/06O/1/9/lsg/Josue)`, `[Joshua 1:9](wmb://bible/06O/1/9/kjv/Joshua)`, `[John 3:16](wmb://bible/43N/3/16/kjv/John)`.',
    'Use exact Bible tool fields only: `bookCode` is the canonical code and `bookName` is the localized returned name.',
    'Copy `bookCode` verbatim from the tool result. Never rewrite it, never drop a leading zero, and never change the testament suffix (`O` or `N`).',
    'Do not reuse example codes for another book. The final link must use the exact `bookCode` returned for that exact verse.',
    'For verse ranges or chapter references, keep the range in the label but link to the first exact verse returned by the tool. Examples: `[Romains 8:29-30](wmb://bible/45N/8/29/lsg/Romains)`, `[Éphésiens 1](wmb://bible/49N/1/1/lsg/Éphésiens)`.',
];

export const SHARED_DOCUMENT_REFERENCE_PROMPT_LINES = [
    '### Document references',
    'Format: `[Title](wmb://doc/{documentId}/{title})`',
];
