export const SHARED_SERMON_REFERENCE_PROMPT_LINES = [
    '### Sermon references',
    'Format: `[Title, §N](wmb://sermon/{sermonId}/{languageCode}/{translationId}/{paragraphNumber})`',
    'Example: if meta.sermonId="56-0805", meta.languageCode="fr", meta.translationId=3, paragraphNumber=45:',
    "→ `[L'Église et sa condition, §45](wmb://sermon/56-0805/fr/3/45)`",
];

export const SHARED_BIBLE_REFERENCE_PROMPT_LINES = [
    '### Bible references',
    'Format: `[BookName Chapter:Verse](wmb://bible/{bookCode}/{chapter}/{verse}/{bibleVersionAbbreviation}/{bookName})`',
    'Examples: `[Jean 3:16](wmb://bible/43N/3/16/lsg/Jean)`, `[John 3:16](wmb://bible/43N/3/16/kjv/John)`, `[Jean 3:16](wmb://bible/43N/3/16/darby/Jean)`',
    'Use exact Bible tool fields only: `bookCode` is the canonical code and `bookName` is the localized returned name.',
];

export const SHARED_DOCUMENT_REFERENCE_PROMPT_LINES = [
    '### Document references',
    'Format: `[Title](wmb://doc/{documentId}/{title})`',
];
