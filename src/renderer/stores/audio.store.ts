import { create } from 'zustand';
import type { CurrentAudioDocumentPlay } from '@shared/types';

interface AudioState {
    currentPlay: CurrentAudioDocumentPlay | null;
    setCurrentPlay(play: CurrentAudioDocumentPlay | null): void;
}

export const useAudioStore = create<AudioState>((set) => ({
    currentPlay: null,
    setCurrentPlay: (play) => set({ currentPlay: play }),
}));
