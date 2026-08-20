import { useEffect, useState } from 'react';
import type { SermonMeta } from '@shared/types';

/** All translations of a sermon available in one language, each with its own audio link. */
export function useSermonTranslations(
    sermonId: string | null | undefined,
    languageCode: string | null | undefined,
): SermonMeta[] {
    const [translations, setTranslations] = useState<SermonMeta[]>([]);

    useEffect(() => {
        if (!sermonId || !languageCode) {
            setTranslations([]);
            return;
        }

        let cancelled = false;
        window.api.documents
            .getTranslationsForSermonInLanguage(sermonId, languageCode)
            .then((next) => {
                if (!cancelled) setTranslations(next);
            })
            .catch(() => {
                if (!cancelled) setTranslations([]);
            });

        return () => {
            cancelled = true;
        };
    }, [sermonId, languageCode]);

    return translations;
}
