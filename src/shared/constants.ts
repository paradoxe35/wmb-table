export const APP_NAME = 'Wmb Table';

export const GITHUB_OWNER = 'paradoxe35';
export const GITHUB_REPO = 'wmb-table';
export const GITHUB_RELEASE_TAG = 'v1.0.0';
export const GITHUB_REPOSITORY = `${GITHUB_OWNER}/${GITHUB_REPO}`;
export const GITHUB_REPO_LINK = `https://github.com/${GITHUB_REPOSITORY}`;
export const GITHUB_RELEASES_LINK = `${GITHUB_REPO_LINK}/releases`;

export function buildGitHubReleaseDownloadBase(tag = GITHUB_RELEASE_TAG): string {
    return `${GITHUB_RELEASES_LINK}/download/${tag}`;
}

export const GITHUB_RELEASE_DOWNLOAD_BASE = buildGitHubReleaseDownloadBase();

export const APP_AUTHOR = 'Paradoxe Ngwasi';
export const APP_AUTHOR_EMAIL = 'paradoxngwasi@gmail.com';
export const APP_LICENSE = 'MIT';

export const WEBSITE_LINK = 'https://wmb-table.web.app/';
export const DOCS_LINK = 'https://wmb-table.web.app/';

export type DocsLocale = 'fr' | 'en' | 'es';

export function normalizeDocsLocale(languageCode?: string | null): DocsLocale {
    const normalized = (languageCode ?? '').toLowerCase();
    if (normalized.startsWith('en')) return 'en';
    if (normalized.startsWith('es')) return 'es';
    return 'fr';
}

export function buildDocsGuideLink(slug: string, languageCode?: string | null): string {
    const locale = normalizeDocsLocale(languageCode);
    const base = DOCS_LINK.replace(/\/$/, '');
    const prefix = locale === 'fr' ? '' : `/${locale}`;
    return `${base}${prefix}/guide/${slug}`;
}

export function buildDocsLink(path: string, languageCode?: string | null): string {
    const locale = normalizeDocsLocale(languageCode);
    const base = DOCS_LINK.replace(/\/$/, '');
    const prefix = locale === 'fr' ? '' : `/${locale}`;
    return `${base}${prefix}/${path}`;
}

export function buildDownloadPageLink(languageCode?: string | null): string {
    const locale = normalizeDocsLocale(languageCode);
    const base = WEBSITE_LINK.replace(/\/$/, '');
    const prefix = locale === 'fr' ? '' : `/${locale}`;
    return `${base}${prefix}/#download`;
}

export const DOCS_CONTACT_LINK = buildDocsLink('contact');
export const DOCS_SUBJECT_LINK = buildDocsGuideLink('subjects');
export const DOCS_NOTE_LINK = buildDocsGuideLink('notes');
export const DOCS_CUSTOM_DOCUMENT_LINK = buildDocsGuideLink('custom-documents');
export const DOCS_AI_CHAT_LINK = buildDocsGuideLink('ai-chat');
export const DOCS_SETTINGS_ASSISTANT_LINK = buildDocsGuideLink('settings-assistant');
export const DOCS_TTS_LINK = buildDocsGuideLink('audio-and-tts');
export const DOCS_BIBLE_LINK = buildDocsGuideLink('bible');

// ── Document tabs ──
export const DEFAULT_MAX_TABS = 10;
export const MIN_MAX_TABS = 5;
export const MAX_MAX_TABS = 50;

// ── UI language ──
export type UiLanguage = 'fr' | 'en' | 'es';
export type UiLanguagePreference = 'auto' | UiLanguage;
const FALLBACK_UI_LANGUAGE: UiLanguage = 'fr';

export const UI_LANGUAGE_OPTIONS: { value: UiLanguagePreference; label: string }[] = [
    { value: 'auto', label: 'Automatique' },
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
];

const UI_LANGUAGE_CODES = new Set<string>(['fr', 'en', 'es']);

/**
 * Resolve the effective UI language.
 * - "auto" or null → derive from content language if supported, else fallback
 * - explicit language (fr/en/es) → use it directly
 */
export function resolveUiLanguage(
    uiPreference: UiLanguagePreference | null | undefined,
    contentLanguage: string | null | undefined,
): UiLanguage {
    if (uiPreference && uiPreference !== 'auto' && UI_LANGUAGE_CODES.has(uiPreference)) {
        return uiPreference;
    }
    // Auto mode: follow content language if it's a supported UI language
    if (contentLanguage && UI_LANGUAGE_CODES.has(contentLanguage)) {
        return contentLanguage as UiLanguage;
    }
    return FALLBACK_UI_LANGUAGE;
}
