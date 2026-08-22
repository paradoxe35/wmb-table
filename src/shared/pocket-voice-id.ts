/**
 * A Pocket voice is a voice inside a language bundle: `<bundle>:<voice>`. Downloaded voices
 * carry a bare name; the other two kinds are spoken from a recording this app holds, either
 * a bundled reference (`ref:`) or one the reader cloned (`clone:`).
 */

const SEPARATOR = ':';
const REFERENCE_PREFIX = 'ref:';
const CLONE_PREFIX = 'clone:';

export function pocketVoiceId(bundle: string, voice: string): string {
    return `${bundle}${SEPARATOR}${voice}`;
}

export function pocketVoiceBundle(voiceId: string): string {
    const at = voiceId.indexOf(SEPARATOR);
    return at === -1 ? voiceId : voiceId.slice(0, at);
}

export function pocketVoiceName(voiceId: string): string {
    const at = voiceId.indexOf(SEPARATOR);
    return at === -1 ? '' : voiceId.slice(at + 1);
}

export function referenceVoiceName(referenceId: string): string {
    return `${REFERENCE_PREFIX}${referenceId}`;
}

/** The reference recording a voice clones, or null when it is not a bundled reference. */
export function referenceIdOf(voiceName: string): string | null {
    return voiceName.startsWith(REFERENCE_PREFIX) ? voiceName.slice(REFERENCE_PREFIX.length) : null;
}

export function clonedVoiceName(name: string): string {
    return `${CLONE_PREFIX}${name}`;
}

/** The cloned recording a voice speaks from, or null when it is not a cloned voice. */
export function clonedIdOf(voiceName: string): string | null {
    return voiceName.startsWith(CLONE_PREFIX) ? voiceName.slice(CLONE_PREFIX.length) : null;
}
