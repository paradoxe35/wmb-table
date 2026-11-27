import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '@shared/i18n/locales/en';
import es from '@shared/i18n/locales/es';
import pt from '@shared/i18n/locales/pt';
import sw from '@shared/i18n/locales/sw';
import {
    CONTINUE_ANSWER_PROMPT,
    CONTINUE_RESEARCH_PROMPT,
    RUN_NOTICE_ACTION_LABELS,
    RUN_NOTICE_TEXT_KEYS,
} from '@renderer/views/options/ai-chat/run-notice-copy';

const SOURCE_ROOT = resolve(__dirname, '../../../../../src/renderer');
const CHAT_VIEW_DIR = resolve(SOURCE_ROOT, 'views/options/ai-chat');

function literalKeys(source: string, pattern: RegExp): string[] {
    return [...source.matchAll(pattern)].map((match) => match[2]);
}

const viewKeys = readdirSync(CHAT_VIEW_DIR)
    .filter((file) => file.endsWith('.tsx'))
    .flatMap((file) =>
        literalKeys(
            readFileSync(resolve(CHAT_VIEW_DIR, file), 'utf8'),
            /\bt\(\s*(['"])((?:\\.|(?!\1).)+)\1/g,
        ),
    );
const storeErrorKeys = literalKeys(
    readFileSync(resolve(SOURCE_ROOT, 'stores/ai-chat.store.ts'), 'utf8'),
    /(?:toErrorMessage\(error,|error:)\s*(['"])((?:\\.|(?!\1).)+)\1/g,
);

const keys = [
    ...new Set([
        ...viewKeys,
        ...storeErrorKeys,
        ...RUN_NOTICE_TEXT_KEYS,
        ...Object.values(RUN_NOTICE_ACTION_LABELS),
        CONTINUE_ANSWER_PROMPT,
        CONTINUE_RESEARCH_PROMPT,
    ]),
];

describe('AI chat texts', () => {
    it('finds the texts it checks', () => {
        expect(keys).toContain('Arrêté par vous.');
        expect(storeErrorKeys).toContain("L'envoi du message a échoué.");
    });

    it.each([
        ['en', en],
        ['es', es],
        ['pt', pt],
        ['sw', sw],
    ])('are all translated in %s', (_language, dictionary) => {
        expect(keys.filter((key) => !(key in dictionary))).toEqual([]);
    });
});
