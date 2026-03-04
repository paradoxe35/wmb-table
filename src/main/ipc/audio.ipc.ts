import { AudioChannels } from '@shared/ipc.types';
import { registerHandler } from './register';

export function registerAudioHandlers(): void {
  registerHandler(AudioChannels.getTimeAndLocalFile, async () => {
    throw new Error('Not implemented: audio:getTimeAndLocalFile');
  });

  registerHandler(AudioChannels.setTime, async () => {
    throw new Error('Not implemented: audio:setTime');
  });

  registerHandler(AudioChannels.getLastPlay, async () => {
    throw new Error('Not implemented: audio:getLastPlay');
  });

  registerHandler(AudioChannels.setLastPlay, async () => {
    throw new Error('Not implemented: audio:setLastPlay');
  });
}
