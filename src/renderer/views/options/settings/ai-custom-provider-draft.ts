import type { AiCustomProviderConfig } from '@shared/ai.types';
import { normalizeApiKey, normalizeBaseUrl, type BaseUrlProblem } from '@shared/ai-provider-input';

export interface CustomProviderDraft {
    name: string;
    baseUrl: string;
    apiKey: string;
    defaultModel: string;
}

export const EMPTY_CUSTOM_PROVIDER_DRAFT: CustomProviderDraft = {
    name: '',
    baseUrl: '',
    apiKey: '',
    defaultModel: '',
};

export interface CustomProviderDraftCheck {
    duplicateName: boolean;
    baseUrlProblem?: BaseUrlProblem;
    provider: AiCustomProviderConfig | null;
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/** A readable id when the name has Latin letters or digits, `custom` otherwise, made unique. */
export function createCustomProviderId(name: string, takenIds: readonly string[]): string {
    const base = slugify(name) || 'custom';
    if (!takenIds.includes(base)) return base;
    let suffix = 2;
    while (takenIds.includes(`${base}-${suffix}`)) suffix++;
    return `${base}-${suffix}`;
}

function sameName(a: string, b: string): boolean {
    return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

export function checkCustomProviderDraft(
    draft: CustomProviderDraft,
    taken: { ids: readonly string[]; names: readonly string[] },
): CustomProviderDraftCheck {
    const name = draft.name.trim();
    const defaultModel = draft.defaultModel.trim();
    const duplicateName = name.length > 0 && taken.names.some((other) => sameName(other, name));
    const baseUrl = normalizeBaseUrl(draft.baseUrl);
    const baseUrlProblem = baseUrl.ok ? undefined : baseUrl.problem;

    if (!name || duplicateName || !baseUrl.ok || !defaultModel) {
        return { duplicateName, baseUrlProblem, provider: null };
    }
    return {
        duplicateName,
        provider: {
            id: createCustomProviderId(name, taken.ids),
            name,
            baseUrl: baseUrl.url,
            apiKey: normalizeApiKey(draft.apiKey),
            defaultModel,
        },
    };
}
