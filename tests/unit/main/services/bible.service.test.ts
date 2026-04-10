import { describe, expect, it } from 'vitest';
import { resolveBibleVersionsForDisplay, type BibleVersion } from '@main/services/bible.service';

function createVersion(
    partial: Partial<BibleVersion> & Pick<BibleVersion, 'abbreviation' | 'langCode'>,
): BibleVersion {
    return {
        name: partial.name ?? partial.abbreviation.toUpperCase(),
        fileName: partial.fileName ?? `${partial.abbreviation}.sqlite`,
        type: partial.type ?? 'remote',
        ...partial,
    };
}

describe('bible.service display resolution', () => {
    it('prefers requested-language versions when that language already has an installed Bible', () => {
        const versions: BibleVersion[] = [
            createVersion({ abbreviation: 'en-kjv', langCode: 'en', type: 'local' }),
            createVersion({ abbreviation: 'es-rv', langCode: 'es', type: 'remote' }),
            createVersion({ abbreviation: 'es-nvi', langCode: 'es', type: 'remote' }),
        ];

        const result = resolveBibleVersionsForDisplay(
            versions,
            'es',
            (version) => version.abbreviation === 'es-rv',
        );

        expect(result.map((version) => version.abbreviation)).toEqual(['es-rv', 'es-nvi']);
    });

    it('keeps installed fallback versions visible until the first content-language Bible is downloaded', () => {
        const versions: BibleVersion[] = [
            createVersion({ abbreviation: 'en-kjv', langCode: 'en', type: 'local' }),
            createVersion({ abbreviation: 'en-web', langCode: 'en', type: 'remote' }),
            createVersion({ abbreviation: 'es-rv', langCode: 'es', type: 'remote' }),
            createVersion({ abbreviation: 'es-nvi', langCode: 'es', type: 'remote' }),
        ];

        const result = resolveBibleVersionsForDisplay(
            versions,
            'es',
            (version) => version.abbreviation === 'en-kjv',
        );

        expect(result.map((version) => version.abbreviation)).toEqual([
            'en-kjv',
            'es-rv',
            'es-nvi',
        ]);
    });

    it('falls back to the first installed language when English is not available', () => {
        const versions: BibleVersion[] = [
            createVersion({ abbreviation: 'fr-lsg', langCode: 'fr', type: 'local' }),
            createVersion({ abbreviation: 'pt-arc', langCode: 'pt', type: 'remote' }),
        ];

        const result = resolveBibleVersionsForDisplay(
            versions,
            'pt',
            (version) => version.abbreviation === 'fr-lsg',
        );

        expect(result.map((version) => version.abbreviation)).toEqual(['fr-lsg', 'pt-arc']);
    });
});
