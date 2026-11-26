import { TtsChannels } from '@shared/ipc.types';
import { registerHandler } from './ipc-bridge';
import { getTtsService } from '@main/services/tts';
import * as ttsRepo from '@main/database/repositories/tts.repository';

export function registerTtsHandlers(): void {
    registerHandler(TtsChannels.getProviders, async () => {
        return getTtsService().getProviderInfos();
    });

    registerHandler(TtsChannels.getSettings, async () => {
        return ttsRepo.ensureSettings();
    });

    registerHandler(TtsChannels.getLastPosition, async () => {
        return ttsRepo.getLastPosition();
    });

    registerHandler(TtsChannels.setLastPosition, async (_event, position) => {
        ttsRepo.setLastPosition(position);
    });

    registerHandler(TtsChannels.updateSettings, async (_event, settings) => {
        const updated = ttsRepo.updateSettings(settings);
        await getTtsService().reloadSettings();
        return updated;
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

    registerHandler(TtsChannels.previewVoice, async (_event, language, voiceId) => {
        return getTtsService().previewVoice(language, voiceId);
    });

    registerHandler(TtsChannels.resolveConfigForLanguage, async (_event, language) => {
        return getTtsService().resolveConfigForLanguage(language);
    });
}
