import {
    getLlama,
    LlamaChatSession,
    type ChatSessionModelFunctions,
    type ChatHistoryItem,
} from 'node-llama-cpp';
import type { LlamaModel } from 'node-llama-cpp';
import log from '@main/lib/logger';
import { compactLocalHistory } from '../context-memory';
import { resolveAutoSelectedLocalModel } from './local-model.service';

const DEFAULT_CONTEXT_SIZE = 4096;
const MAX_TOKENS = 768;

export class LocalRuntimeService {
    private static readonly IDLE_DISPOSE_MS = 5 * 60 * 1000;

    private activeModelPath: string | null = null;
    private activeGpu = false;
    private model: LlamaModel | null = null;
    private disposeTimer: NodeJS.Timeout | null = null;
    private loadingPromise: Promise<void> | null = null;
    private gpuEnabled = false;

    async run(input: {
        selectedModel: string | null | undefined;
        systemPrompt: string;
        history: ChatHistoryItem[];
        prompt: string;
        functions?: ChatSessionModelFunctions;
        signal?: AbortSignal;
        onTextChunk?: (chunk: string) => void;
    }): Promise<string> {
        const localModel = await resolveAutoSelectedLocalModel(input.selectedModel);
        if (!localModel?.localPath) {
            throw new Error('Aucun modèle local GGUF trouvé dans ~/.wmb-table/ai-models.');
        }

        const contextSize = localModel.contextSize ?? DEFAULT_CONTEXT_SIZE;

        await this.ensureModel(localModel.localPath);
        if (!this.model) {
            throw new Error('Le modèle local n\u2019est pas chargé.');
        }

        const compactedHistory = compactLocalHistory(
            input.systemPrompt,
            input.history,
            input.prompt,
            contextSize,
        );

        const context = await this.model.createContext({
            contextSize,
            ignoreMemorySafetyChecks: true,
        });
        const session = new LlamaChatSession({
            contextSequence: context.getSequence(),
            systemPrompt: input.systemPrompt,
        });
        session.setChatHistory(compactedHistory);

        try {
            return await session.prompt(input.prompt, {
                functions: input.functions,
                signal: input.signal,
                stopOnAbortSignal: true,
                onTextChunk: input.onTextChunk,
                maxTokens: MAX_TOKENS,
            });
        } finally {
            session.dispose({ disposeSequence: true });
            await context.dispose();
            this.scheduleDispose();
        }
    }

    async dispose(): Promise<void> {
        this.clearDisposeTimer();
        if (this.model) {
            log.info('Local model disposing', { modelPath: this.activeModelPath });
            await this.model.dispose();
            this.model = null;
            this.activeModelPath = null;
        }
    }

    private async ensureModel(modelPath: string): Promise<void> {
        // Wait for any in-flight loading to complete before proceeding
        if (this.loadingPromise) {
            await this.loadingPromise;
        }

        this.clearDisposeTimer();

        if (
            this.activeModelPath === modelPath &&
            this.model &&
            this.activeGpu === this.gpuEnabled
        ) {
            return;
        }

        this.loadingPromise = this.loadModel(modelPath);
        try {
            await this.loadingPromise;
        } finally {
            this.loadingPromise = null;
        }
    }

    setGpuEnabled(enabled: boolean): void {
        this.gpuEnabled = enabled;
    }

    private async loadModel(modelPath: string): Promise<void> {
        await this.dispose();
        const useGpu = this.gpuEnabled;
        log.info('Local model loading', { modelPath, gpu: useGpu });

        const llama = await getLlama({ gpu: useGpu ? 'auto' : false });
        this.model = await llama.loadModel({
            modelPath,
            gpuLayers: useGpu ? 'auto' : 0,
        });

        this.activeModelPath = modelPath;
        this.activeGpu = useGpu;
        log.info('Local model loaded', { modelPath, gpu: useGpu });
    }

    private scheduleDispose(): void {
        this.clearDisposeTimer();
        this.disposeTimer = setTimeout(() => {
            log.info('Local model idle timeout, disposing');
            void this.dispose();
        }, LocalRuntimeService.IDLE_DISPOSE_MS);
    }

    private clearDisposeTimer(): void {
        if (this.disposeTimer) {
            clearTimeout(this.disposeTimer);
            this.disposeTimer = null;
        }
    }
}
