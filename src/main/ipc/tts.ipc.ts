import { get_sentence_boundaries } from 'sentencex';
import { TtsChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import { getTtsService } from '@main/services/tts';
import * as ttsRepo from '@main/database/repositories/tts.repository';
import type { TtsSegment } from '@shared/tts.types';

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
        getTtsService().seekToSegment(index);
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

    registerHandler(TtsChannels.cloneVoice, async (_event, request) => {
        return getTtsService().cloneVoice(request);
    });

    registerHandler(TtsChannels.listClonedVoices, async () => {
        return getTtsService().listClonedVoices();
    });

    registerHandler(TtsChannels.deleteClonedVoice, async (_event, voiceId) => {
        await getTtsService().deleteClonedVoice(voiceId);
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
            if (!text) continue;
            const boundaries: { start_index: number; end_index: number; text: string }[] =
                get_sentence_boundaries(language, clean);
            for (const b of boundaries) {
                const sentenceText = b.text.trim();
                if (!sentenceText) continue;
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
