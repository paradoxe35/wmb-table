import type { AiLocalModelInfo } from '@shared/ai.types';

type KnownLocalModelSeed = Omit<AiLocalModelInfo, 'downloaded' | 'localPath' | 'sizeBytes'> & {
    aliases: string[];
    description: string;
    downloadUrl: string;
    directDownloadUrl: string;
    expectedFileName: string;
    approximateSizeMb: number;
    contextSize: number;
};

export const KNOWN_LOCAL_MODELS: KnownLocalModelSeed[] = [
    {
        id: 'qwen3.5-2b',
        name: 'Qwen 3.5 — Recommandé',
        family: 'qwen',
        fileName: 'qwen3.5-2b',
        quantization: 'Q4_K_M',
        recommended: true,
        description:
            'Bonne qualité de réponse, rapide et léger (~1,3 Go). Fonctionne sur la plupart des ordinateurs.',
        downloadUrl: 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF',
        directDownloadUrl:
            'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf',
        expectedFileName: 'Qwen3.5-2B-Q4_K_M.gguf',
        approximateSizeMb: 1280,
        contextSize: 8192,
        aliases: ['qwen3.5-2b', 'qwen3.5', 'qwen'],
    },
    {
        id: 'qwen3.5-0.8b',
        name: 'Qwen 3.5 — Léger',
        family: 'qwen',
        fileName: 'qwen3.5-0.8b',
        quantization: 'Q4_K_M',
        recommended: false,
        description:
            'Très rapide et très léger (~550 Mo). Pour les ordinateurs anciens ou avec peu de mémoire.',
        downloadUrl: 'https://huggingface.co/AaryanK/Qwen3.5-0.8B-GGUF',
        directDownloadUrl:
            'https://huggingface.co/AaryanK/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B.q4_k_m.gguf',
        expectedFileName: 'Qwen3.5-0.8B.q4_k_m.gguf',
        approximateSizeMb: 550,
        contextSize: 8192,
        aliases: ['qwen3.5-0.8b'],
    },
];
