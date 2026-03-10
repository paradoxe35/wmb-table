import { TtsChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import { getTtsService } from '@main/services/tts';
import * as ttsRepo from '@main/database/repositories/tts.repository';

export function registerTtsHandlers(): void {
    registerHandler(TtsChannels.getProviders, async () => {
        return getTtsService().getProviderInfos();
    });

    registerHandler(TtsChannels.getSettings, async () => {
        return ttsRepo.ensureSettings();
    });

    registerHandler(TtsChannels.updateSettings, async (_event, settings) => {
        ttsRepo.updateSettings(settings);
        getTtsService().reloadSettings();
    });

    registerHandler(TtsChannels.synthesize, async (_event, request) => {
        return getTtsService().synthesize(request);
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

    registerHandler(TtsChannels.getModelStatus, async (_event, provider) => {
        return getTtsService().getModelStatus(provider);
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
}
