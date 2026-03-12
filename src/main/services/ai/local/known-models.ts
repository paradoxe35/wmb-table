import type { AiLocalModelInfo } from '@shared/ai.types';

type KnownLocalModelSeed = Omit<AiLocalModelInfo, 'downloaded' | 'localPath' | 'sizeBytes'> & {
    aliases: string[];
    description: string;
    downloadUrl: string;
    directDownloadUrl: string;
    expectedFileName: string;
    approximateSizeMb: number;
};

export const KNOWN_LOCAL_MODELS: KnownLocalModelSeed[] = [
    {
        id: 'qwen3.5-0.8b',
        name: 'Qwen 3.5',
        family: 'qwen',
        fileName: 'qwen3.5-0.8b',
        quantization: 'Q4_K_M',
        recommended: true,
        description:
            'Léger et rapide. Idéal pour un usage quotidien sur la plupart des ordinateurs.',
        downloadUrl: 'https://huggingface.co/AaryanK/Qwen3.5-0.8B-GGUF',
        directDownloadUrl:
            'https://huggingface.co/AaryanK/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B.q4_k_m.gguf',
        expectedFileName: 'Qwen3.5-0.8B.q4_k_m.gguf',
        approximateSizeMb: 550,
        aliases: ['qwen3.5-0.8b', 'qwen3.5', 'qwen'],
    },
    {
        id: 'gemma3-1b',
        name: 'Gemma 3',
        family: 'gemma',
        fileName: 'gemma3-1b',
        quantization: 'Q4_K_M',
        recommended: false,
        description: 'Plus complet, meilleure compréhension. Nécessite un peu plus de mémoire.',
        downloadUrl: 'https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF',
        directDownloadUrl:
            'https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf',
        expectedFileName: 'gemma-3-1b-it-Q4_K_M.gguf',
        approximateSizeMb: 750,
        aliases: ['gemma3-1b', 'gemma-3-1b', 'gemma'],
    },
];
