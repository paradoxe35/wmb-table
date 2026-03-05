import { createContext, useContext, useRef, type RefObject } from 'react';

const AudioRefContext = createContext<RefObject<HTMLAudioElement | null>>({ current: null });

export function AudioProvider({ children }: { children: React.ReactNode }) {
    const audioRef = useRef<HTMLAudioElement>(null);

    return (
        <AudioRefContext.Provider value={audioRef}>
            <audio ref={audioRef} preload="auto" />
            {children}
        </AudioRefContext.Provider>
    );
}

export function useAudioRef() {
    return useContext(AudioRefContext);
}
