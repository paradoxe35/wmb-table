import { describe, expect, it } from 'vitest';
import { isAiConfigured } from '@renderer/lib/feature-reminders';
import { createDefaultAiSettings, type AiSettings } from '@shared/ai.types';

function settingsWith(patch: Partial<AiSettings>): AiSettings {
    return { ...createDefaultAiSettings(), ...patch };
}

function withBuiltin(
    id: keyof AiSettings['providers'],
    config: Partial<AiSettings['providers']['openai']>,
    patch: Partial<AiSettings> = {},
): AiSettings {
    const base = createDefaultAiSettings();
    return {
        ...base,
        activeProvider: id,
        providers: { ...base.providers, [id]: { ...base.providers[id], ...config } },
        ...patch,
    };
}

const MOCK = {
    id: 'mock-llm',
    name: 'Mock LLM',
    baseUrl: 'http://127.0.0.1:1234/v1',
    defaultModel: 'mock-model',
};

describe('isAiConfigured', () => {
    it('is false without settings or with the defaults', () => {
        expect(isAiConfigured(null)).toBe(false);
        expect(isAiConfigured(createDefaultAiSettings())).toBe(false);
    });

    it('ignores the old enabled flag', () => {
        const configured = withBuiltin('openai', { apiKey: 'sk-test' });
        expect(isAiConfigured({ ...configured, enabled: false })).toBe(true);
        expect(isAiConfigured({ ...configured, enabled: true })).toBe(true);
    });

    it('needs an API key for a cloud provider', () => {
        expect(isAiConfigured(withBuiltin('openai', {}))).toBe(false);
        expect(isAiConfigured(withBuiltin('openai', { apiKey: '   ' }))).toBe(false);
        expect(isAiConfigured(withBuiltin('claude', { apiKey: 'sk-ant' }))).toBe(true);
    });

    it('does not depend on the per-provider enabled flag, which nothing sets', () => {
        expect(isAiConfigured(withBuiltin('gemini', { apiKey: 'key', enabled: false }))).toBe(true);
    });

    it('accepts Ollama without a key', () => {
        expect(isAiConfigured(withBuiltin('ollama', {}))).toBe(true);
    });

    it('needs a model, which built-in providers take from their default', () => {
        expect(isAiConfigured(withBuiltin('ollama', { model: null }))).toBe(true);
        expect(
            isAiConfigured(
                settingsWith({
                    activeProvider: MOCK.id,
                    customProviders: [{ ...MOCK, defaultModel: '', model: null }],
                }),
            ),
        ).toBe(false);
    });

    it('accepts a custom provider with an address and a model', () => {
        expect(
            isAiConfigured(settingsWith({ activeProvider: MOCK.id, customProviders: [MOCK] })),
        ).toBe(true);
        expect(
            isAiConfigured(
                settingsWith({
                    activeProvider: MOCK.id,
                    customProviders: [{ ...MOCK, baseUrl: '' }],
                }),
            ),
        ).toBe(false);
    });

    it('is false when the active custom provider was removed', () => {
        expect(isAiConfigured(settingsWith({ activeProvider: MOCK.id }))).toBe(false);
    });
});
