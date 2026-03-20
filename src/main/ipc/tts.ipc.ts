import { get_sentence_boundaries } from 'sentencex';
import { TtsChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import { getTtsService } from '@main/services/tts';
import * as ttsRepo from '@main/database/repositories/tts.repository';
import { hasSpeakableContent, type TtsSegment } from '@shared/tts.types';

function stripMarkers(content: string): { clean: string; posMap: number[] } {
    const posMap: number[] = [];
    let clean = '';
    for (let i = 0; i < content.length; i++) {
        const c = content[i];
        if (c !== '*' && c !== '^') {
            posMap.push(i);
            clean += c;
        }
    }
    return { clean, posMap };
}

// ── Sentence merge pass ──
// sentencex splits aggressively on punctuation (e.g. "Merci, Frère...?..."
// becomes its own segment). We merge short fragments with their neighbor
// so TTS reads natural-sounding chunks, while keeping segments under a max
// length to avoid synthesis latency.

const MIN_SEGMENT_CHARS = 40;
const MAX_SEGMENT_CHARS = 400;

interface Boundary {
    start_index: number;
    end_index: number;
    text: string;
}

/**
 * Merge consecutive boundaries that are too short to sound natural on their own.
 * Short fragments are appended to the previous boundary when possible,
 * or prepended to the next one if they are the first in the paragraph.
 */
function mergeBoundaries(raw: Boundary[]): Boundary[] {
    if (raw.length <= 1) return raw;

    const merged: Boundary[] = [];
    let acc: Boundary | null = null;

    for (const b of raw) {
        const trimmed = b.text.trim();
        if (!trimmed || !hasSpeakableContent(trimmed)) continue;

        if (!acc) {
            acc = { ...b };
            continue;
        }

        const accLen = acc.text.trim().length;
        const bLen = trimmed.length;

        // Merge into accumulator if either side is too short and combined
        // length stays under the max.
        if (
            (accLen < MIN_SEGMENT_CHARS || bLen < MIN_SEGMENT_CHARS) &&
            accLen + bLen + 1 <= MAX_SEGMENT_CHARS
        ) {
            acc = {
                start_index: acc.start_index,
                end_index: b.end_index,
                text: acc.text + ' ' + b.text,
            };
        } else {
            merged.push(acc);
            acc = { ...b };
        }
    }

    if (acc) merged.push(acc);
    return merged;
}

export function registerTtsHandlers(): void {
    registerHandler(TtsChannels.getProviders, async () => {
        return getTtsService().getProviderInfos();
    });

    registerHandler(TtsChannels.getSettings, async () => {
        return ttsRepo.ensureSettings();
    });

    registerHandler(TtsChannels.updateSettings, async (_event, settings) => {
        ttsRepo.updateSettings(settings);
        await getTtsService().reloadSettings();
    });

    registerHandler(TtsChannels.startPlayback, async (_event, segments, language, startIndex) => {
        await getTtsService().startPlayback(segments, language, startIndex ?? 0);
    });

    registerHandler(TtsChannels.pausePlayback, async () => {
        getTtsService().pause();
    });

    registerHandler(TtsChannels.resumePlayback, async () => {
        getTtsService().resume();
    });

    registerHandler(TtsChannels.stopPlayback, async () => {
        getTtsService().stop();
    });

    registerHandler(TtsChannels.seekToSegment, async (_event, index) => {
        await getTtsService().seekToSegment(index);
    });

    registerHandler(TtsChannels.segmentComplete, async () => {
        await getTtsService().onSegmentComplete();
    });

    registerHandler(TtsChannels.checkLanguageSupport, async (_event, langCode) => {
        return getTtsService().checkLanguageSupport(langCode);
    });

    registerHandler(TtsChannels.downloadModel, async (_event, provider, modelName) => {
        await getTtsService().downloadModel(provider, modelName);
    });

    registerHandler(TtsChannels.clearCache, async () => {
        await getTtsService().clearCache();
    });

    registerHandler(TtsChannels.getCacheSize, async () => {
        return getTtsService().getCacheSize();
    });

    registerHandler(TtsChannels.cloneVoice, async (_event, providerType, request) => {
        return getTtsService().cloneVoice(providerType, request);
    });

    registerHandler(TtsChannels.listClonedVoices, async (_event, providerType) => {
        return getTtsService().listClonedVoices(providerType);
    });

    registerHandler(TtsChannels.deleteClonedVoice, async (_event, providerType, voiceId) => {
        await getTtsService().deleteClonedVoice(providerType, voiceId);
    });

    registerHandler(TtsChannels.getReferenceVoiceAudio, async (_event, referenceId) => {
        return getTtsService().getReferenceVoiceAudio(referenceId);
    });

    registerHandler(TtsChannels.getProviderModels, async (_event, provider) => {
        return getTtsService().getProviderModels(provider);
    });

    registerHandler(TtsChannels.deleteProviderModel, async (_event, provider, modelName) => {
        await getTtsService().deleteProviderModel(provider, modelName);
    });

    registerHandler(TtsChannels.previewVoice, async (_event, language) => {
        return getTtsService().previewVoice(language);
    });

    registerHandler(TtsChannels.resolveConfigForLanguage, async (_event, language) => {
        return getTtsService().resolveConfigForLanguage(language);
    });

    registerHandler(TtsChannels.segmentParagraphs, (_event, paragraphs, language) => {
        let index = 0;
        const segments: TtsSegment[] = [];
        for (const p of paragraphs) {
            if (!p.content.trim()) continue;
            const { clean, posMap } = stripMarkers(p.content);
            const text = clean.trim();
            if (!text || !hasSpeakableContent(text)) {
                continue;
            }

            let rawBoundaries: Boundary[];
            try {
                rawBoundaries = get_sentence_boundaries(language, clean);
            } catch {
                // sentencex panics on some multi-byte UTF-8 — single-segment fallback
                segments.push({
                    index: index++,
                    text: text.replace(/\s+/g, ' '),
                    paragraphIndex: p.paragraphIndex,
                    startOffset: 0,
                    endOffset: p.content.length,
                });
                continue;
            }

            const boundaries = mergeBoundaries(rawBoundaries);

            for (const b of boundaries) {
                const sentenceText = b.text.trim();
                if (!sentenceText || !hasSpeakableContent(sentenceText)) continue;
                const startOffset = posMap[b.start_index] ?? 0;
                const endOffset =
                    b.end_index > 0
                        ? (posMap[b.end_index - 1] ?? p.content.length - 1) + 1
                        : p.content.length;
                segments.push({
                    index: index++,
                    text: sentenceText,
                    paragraphIndex: p.paragraphIndex,
                    startOffset,
                    endOffset,
                });
            }
        }
        return segments;
    });
}
