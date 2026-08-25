export interface SherpaAudio {
    samples: Float32Array;
    sampleRate: number;
}

interface GenerationConfig {
    sid: number;
    speed: number;
    extra?: { lang: string };
}

interface SherpaTts {
    generateWithConfig(text: string, config: GenerationConfig): SherpaAudio;
}

/**
 * sherpa's `generate()` rebuilds the generation config from `sid` and `speed` alone, dropping
 * the `extra` that carries the language: supertonic then reads every language as English.
 * `generateWithConfig` forwards the config untouched.
 */
export function generateAudio(
    tts: SherpaTts,
    text: string,
    sid: number,
    speed: number,
    lang?: string,
): SherpaAudio {
    if (!lang) return tts.generateWithConfig(text, { sid, speed });

    try {
        return tts.generateWithConfig(text, { sid, speed, extra: { lang } });
    } catch {
        // Supertonic throws on a language it does not hold. Reading the text in the model's
        // default language is wrong, but silence in the middle of a sermon is worse.
        return tts.generateWithConfig(text, { sid, speed });
    }
}
