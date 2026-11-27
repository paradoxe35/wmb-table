import { AudioChannels } from '@shared/ipc.types';
import { registerHandler } from './ipc-bridge';
import * as audioRepo from '@main/database/repositories/audio.repository';
import { cacheAudio } from '@main/services/audio-cache.service';

export function registerAudioHandlers(): void {
    registerHandler(AudioChannels.getTimeAndLocalFile, async (_event, audioLink) => {
        const time = audioRepo.getTimeByAudioLink(audioLink);
        const download = audioRepo.getDownloadByAudioLink(audioLink);
        return { time, download };
    });

    registerHandler(AudioChannels.setTime, async (_event, audioLink, time) => {
        audioRepo.setTime(audioLink, time);
    });

    registerHandler(AudioChannels.getLastPlay, async () => {
        return audioRepo.getLastPlay();
    });

    registerHandler(AudioChannels.setLastPlay, async (_event, docJson) => {
        audioRepo.setLastPlay(docJson);
    });

    registerHandler(AudioChannels.cacheAudio, async (_event, audioLink) => {
        cacheAudio(audioLink).catch(() => {});
    });
}
