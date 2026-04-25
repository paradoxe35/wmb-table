import { VERSION_BLUEPRINTS } from './config.mjs';
import { mapLocalLanguageToHelloaoLanguage, readSupportedLanguageCodes } from './languages.mjs';
import {
    fetchBibleDataForResolvedVersion,
    fetchHelloaoTranslationCatalog,
    getGetBibleAvailability,
    isHelloaoTranslationComplete,
} from './sources.mjs';

function buildResolvedVersion(blueprint, candidate) {
    return {
        abbreviation: blueprint.abbreviation,
        langCode: blueprint.langCode,
        name: blueprint.name,
        fileName: blueprint.fileName,
        distribution: blueprint.distribution,
        source: candidate.source,
        sourceVersionId: candidate.id,
    };
}

async function resolveBlueprint(blueprint, helloaoTranslationsById) {
    const reasons = [];

    for (const candidate of blueprint.sourceCandidates) {
        if (candidate.source === 'getbible') {
            const availability = await getGetBibleAvailability(candidate.id);
            if (availability?.isCanonicalComplete) {
                return {
                    version: buildResolvedVersion(blueprint, candidate),
                    skipped: [],
                };
            }

            reasons.push(
                `${candidate.source}:${candidate.id} does not expose the full canonical 66-book set`,
            );
            continue;
        }

        if (candidate.source === 'helloao') {
            const translation = helloaoTranslationsById.get(candidate.id);
            const expectedLanguage = mapLocalLanguageToHelloaoLanguage(blueprint.langCode);
            if (
                isHelloaoTranslationComplete(translation) &&
                translation.language === expectedLanguage
            ) {
                return {
                    version: buildResolvedVersion(blueprint, candidate),
                    skipped: [],
                };
            }

            reasons.push(
                `${candidate.source}:${candidate.id} is missing, incomplete, or mapped to a different language`,
            );
        }
    }

    return {
        version: null,
        skipped: [{ abbreviation: blueprint.abbreviation, reason: reasons.join('; ') }],
    };
}

export async function resolveVersionCatalog({ supportedLanguagesDbPath }) {
    const supportedLanguages = new Set(readSupportedLanguageCodes(supportedLanguagesDbPath));
    const helloaoTranslations = await fetchHelloaoTranslationCatalog();
    const helloaoTranslationsById = new Map(
        helloaoTranslations.map((translation) => [translation.id, translation]),
    );

    const versions = [];
    const skippedVersions = [];

    for (const blueprint of VERSION_BLUEPRINTS) {
        if (!supportedLanguages.has(blueprint.langCode)) {
            continue;
        }

        const resolution = await resolveBlueprint(blueprint, helloaoTranslationsById);
        if (resolution.version) {
            versions.push(resolution.version);
        } else {
            skippedVersions.push(...resolution.skipped);
        }
    }

    const resolvedLanguages = new Set(versions.map((version) => version.langCode));
    const skippedLanguages = [...supportedLanguages]
        .filter((language) => !resolvedLanguages.has(language))
        .sort((left, right) => left.localeCompare(right));

    return {
        versions: versions.sort((left, right) =>
            left.langCode === right.langCode
                ? left.abbreviation.localeCompare(right.abbreviation)
                : left.langCode.localeCompare(right.langCode),
        ),
        skippedLanguages,
        skippedVersions,
    };
}

export async function fetchSourceBibleData(config) {
    return fetchBibleDataForResolvedVersion(config);
}
