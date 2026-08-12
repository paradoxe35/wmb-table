/**
 * Lets a script import the app's TypeScript modules directly instead of restating their
 * logic: it resolves the `@main/*` and `@shared/*` aliases, and supplies the `.ts` extension
 * the sources leave off. Node strips the types itself; nothing is compiled.
 *
 * Load it ahead of the script:
 * `node --import ./scripts/ts-aliases.mjs scripts/<name>.mjs`.
 */

import { statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const ALIASES = { '@main': 'src/main', '@shared': 'src/shared' };

function aliasedPath(specifier) {
    for (const [alias, directory] of Object.entries(ALIASES)) {
        if (specifier.startsWith(`${alias}/`)) {
            return resolve(projectRoot, directory, specifier.slice(alias.length + 1));
        }
    }
    return null;
}

function isFile(path) {
    try {
        return statSync(path).isFile();
    } catch {
        return false;
    }
}

/** `tts.types` reads as an extension to `path`, so ask the disk rather than the file name. */
function asModuleUrl(file) {
    return pathToFileURL(isFile(file) ? file : `${file}.ts`).href;
}

registerHooks({
    resolve(specifier, context, next) {
        const aliased = aliasedPath(specifier);
        if (aliased) return next(asModuleUrl(aliased), context);

        const relativeToSource = specifier.startsWith('.') && context.parentURL?.endsWith('.ts');
        if (relativeToSource) {
            return next(asModuleUrl(fileURLToPath(new URL(specifier, context.parentURL))), context);
        }

        return next(specifier, context);
    },
});
