import { describe, expect, it } from 'vitest';
import { BUILTIN_PROVIDER_IDS } from '@shared/ai.types';
import {
    checkCustomProviderDraft,
    createCustomProviderId,
    type CustomProviderDraft,
} from '@renderer/views/options/settings/ai-custom-provider-draft';

const taken = { ids: [...BUILTIN_PROVIDER_IDS, 'lm-studio'], names: ['OpenAI', 'LM Studio'] };

function draft(partial: Partial<CustomProviderDraft>): CustomProviderDraft {
    return {
        name: 'Mon IA',
        baseUrl: 'http://127.0.0.1:1234/v1',
        apiKey: '',
        defaultModel: 'qwen',
        ...partial,
    };
}

describe('createCustomProviderId', () => {
    it('keeps a readable slug for Latin names, accents removed', () => {
        expect(createCustomProviderId('Mon Service Élevé', [])).toBe('mon-service-eleve');
    });

    it.each(['Мой ИИ', 'مساعدي', '我的助手', '🤖✨', '!!!'])(
        'gives a usable id to a name without Latin letters: %s',
        (name) => {
            expect(createCustomProviderId(name, [])).toBe('custom');
            expect(createCustomProviderId(name, ['custom', 'custom-2'])).toBe('custom-3');
        },
    );

    it('never reuses a builtin or existing id', () => {
        expect(createCustomProviderId('OpenAI', BUILTIN_PROVIDER_IDS)).toBe('openai-2');
        expect(createCustomProviderId('LM Studio', taken.ids)).toBe('lm-studio-2');
    });
});

describe('checkCustomProviderDraft', () => {
    it.each(['Мой ИИ', 'مساعدي', '我的助手', '🤖 Bot'])('can add a provider named %s', (name) => {
        const check = checkCustomProviderDraft(draft({ name }), taken);
        expect(check.provider).toMatchObject({ name, id: expect.stringMatching(/^[a-z0-9-]+$/) });
    });

    it('trims every field and the API key', () => {
        const check = checkCustomProviderDraft(
            draft({
                name: '  Mon IA ',
                baseUrl: ' http://127.0.0.1:1234/v1/ ',
                apiKey: ' sk-123\n',
                defaultModel: ' qwen ',
            }),
            taken,
        );
        expect(check.provider).toEqual({
            id: 'mon-ia',
            name: 'Mon IA',
            baseUrl: 'http://127.0.0.1:1234/v1',
            apiKey: 'sk-123',
            defaultModel: 'qwen',
        });
    });

    it('stores no API key when it is blank', () => {
        expect(checkCustomProviderDraft(draft({ apiKey: '  ' }), taken).provider?.apiKey).toBe(
            undefined,
        );
    });

    it.each([
        ['localhost:11434', 'scheme'],
        ['ftp://host/v1', 'scheme'],
        ['http://exa mple', 'invalid'],
        ['', 'empty'],
    ])('blocks the base URL %j (%s)', (baseUrl, problem) => {
        const check = checkCustomProviderDraft(draft({ baseUrl }), taken);
        expect(check.provider).toBeNull();
        expect(check.baseUrlProblem).toBe(problem);
    });

    it('blocks a name already used, ignoring case and spaces', () => {
        const check = checkCustomProviderDraft(draft({ name: ' lm studio ' }), taken);
        expect(check.duplicateName).toBe(true);
        expect(check.provider).toBeNull();
        expect(checkCustomProviderDraft(draft({ name: 'openai' }), taken).duplicateName).toBe(true);
    });

    it('blocks an empty name or model', () => {
        expect(checkCustomProviderDraft(draft({ name: '  ' }), taken).provider).toBeNull();
        expect(checkCustomProviderDraft(draft({ defaultModel: ' ' }), taken).provider).toBeNull();
    });
});
