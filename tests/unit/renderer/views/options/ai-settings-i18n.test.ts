import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '@shared/i18n/locales/en';
import es from '@shared/i18n/locales/es';
import pt from '@shared/i18n/locales/pt';
import sw from '@shared/i18n/locales/sw';

const settingsDir = resolve(__dirname, '../../../../../src/renderer/views/options/settings');
const aiSettingsFiles = readdirSync(settingsDir)
    .filter((file) => /^(ai-|use-save-ai-)/.test(file))
    .map((file) => join(settingsDir, file));

const LITERAL_KEY = /\bt\(\s*(['"])((?:\\.|(?!\1).)+)\1/g;
const RETURNED_KEY = /return\s+(['"])((?:\\.|(?!\1).)+)\1;/g;

function keysIn(source: string): string[] {
    return [...source.matchAll(LITERAL_KEY), ...source.matchAll(RETURNED_KEY)].map((m) =>
        m[2].replace(/\\(['"])/g, '$1'),
    );
}

describe('AI settings translations', () => {
    const keys = [
        ...new Set(aiSettingsFiles.flatMap((file) => keysIn(readFileSync(file, 'utf8')))),
    ];

    it('finds the keys it checks', () => {
        expect(keys).toContain("L'URL doit commencer par http:// ou https://.");
        expect(keys).toContain("Choisissez un fournisseur pour utiliser l'assistant.");
    });

    it.each([
        ['en', en],
        ['es', es],
        ['pt', pt],
        ['sw', sw],
    ])('every key is translated in %s', (_name, locale) => {
        expect(keys.filter((key) => !locale[key])).toEqual([]);
    });
});
