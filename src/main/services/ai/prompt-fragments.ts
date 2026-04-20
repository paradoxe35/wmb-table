export const SHARED_SERMON_REFERENCE_PROMPT_LINES = [
    '### Sermon references',
    'Format: `[Title, §N](wmb://sermon/{sermonId}/{languageCode}/{translationId}/{paragraphNumber})`',
    'Example: if meta.sermonId="56-0805", meta.languageCode="fr", meta.translationId=3, paragraphNumber=45:',
    "→ `[L'Église et sa condition, §45](wmb://sermon/56-0805/fr/3/45)`",
    'For paragraph ranges, keep the range in the label but link to the first exact paragraph returned by the tool. Example: `[Le Premier Sceau, §157-160](wmb://sermon/63-0318/fr/1/157)`.',
    'In prose and summaries, prefer the human-readable sermon title. Do not leave standalone raw sermon IDs like `62-0318` or `63-0728` when the title is available from tool results. Use the sermonId only when the title is unavailable or extra disambiguation is genuinely needed.',
];

export const SHARED_BIBLE_REFERENCE_PROMPT_LINES = [
    '### Bible references',
    'Format: `[BookName Chapter:Verse](wmb://bible/{bookCode}/{chapter}/{verse}/{bibleVersionAbbreviation}/{bookName})`',
    'Examples: `[Jean 3:16](wmb://bible/43N/3/16/lsg/Jean)`, `[John 3:16](wmb://bible/43N/3/16/kjv/John)`, `[Jean 3:16](wmb://bible/43N/3/16/darby/Jean)`',
    'Use exact Bible tool fields only: `bookCode` is the canonical code and `bookName` is the localized returned name.',
    'For verse ranges or chapter references, keep the range in the label but link to the first exact verse returned by the tool. Examples: `[Romains 8:29-30](wmb://bible/45N/8/29/lsg/Romains)`, `[Éphésiens 1](wmb://bible/49N/1/1/lsg/Éphésiens)`.',
];

export const SHARED_DOCUMENT_REFERENCE_PROMPT_LINES = [
    '### Document references',
    'Format: `[Title](wmb://doc/{documentId}/{title})`',
];
