/**
 * A Sherpa voice is one speaker inside a model: `<modelName>:<speaker>`. The model is kept
 * beside it in settings, so this is needed only where a voice arrives on its own — choosing
 * one, or auditioning it. The shape is owned here rather than taken apart at each call site,
 * which is how a colon once reached a Windows `mkdir`.
 */

const SEPARATOR = ':';

export function sherpaVoiceId(modelName: string, speaker = 0): string {
    return `${modelName}${SEPARATOR}${speaker}`;
}

/** The model a voice belongs to; the whole id when it carries no speaker. */
export function sherpaVoiceModel(voiceId: string): string {
    const at = voiceId.lastIndexOf(SEPARATOR);
    return at === -1 ? voiceId : voiceId.slice(0, at);
}

/** The speaker inside the model, and 0 for anything that does not name one. */
export function sherpaVoiceSpeaker(voiceId: string): number {
    const at = voiceId.lastIndexOf(SEPARATOR);
    if (at === -1) return 0;

    const speaker = Number(voiceId.slice(at + 1));
    return Number.isInteger(speaker) && speaker >= 0 ? speaker : 0;
}

export function isSherpaVoiceOf(voiceId: string, modelName: string): boolean {
    return sherpaVoiceModel(voiceId) === modelName;
}
