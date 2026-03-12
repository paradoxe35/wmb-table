import {
    getLlama,
    LlamaChatSession,
    type ChatSessionModelFunctions,
    type ChatHistoryItem,
} from 'node-llama-cpp';
import type { LlamaModel } from 'node-llama-cpp';
import { resolveAutoSelectedLocalModel } from './local-model.service';

export class LocalRuntimeService {
    private static readonly IDLE_DISPOSE_MS = 5 * 60 * 1000;

    private activeModelPath: string | null = null;
    private model: LlamaModel | null = null;
    private disposeTimer: NodeJS.Timeout | null = null;

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

        await this.ensureModel(localModel.localPath);
        if (!this.model) {
            throw new Error('Le modèle local n’est pas chargé.');
        }

        const context = await this.model.createContext();
        const session = new LlamaChatSession({
            contextSequence: context.getSequence(),
            systemPrompt: input.systemPrompt,
        });
        session.setChatHistory(input.history);

        try {
            return await session.prompt(input.prompt, {
                functions: input.functions,
                signal: input.signal,
                stopOnAbortSignal: true,
                onTextChunk: input.onTextChunk,
                maxTokens: 768,
            });
        } finally {
            session.dispose({ disposeSequence: true });
            await context.dispose();
            this.scheduleDispose();
        }
    }

    async dispose(): Promise<void> {
        if (this.disposeTimer) {
            clearTimeout(this.disposeTimer);
            this.disposeTimer = null;
        }
        await this.model?.dispose();
        this.model = null;
        this.activeModelPath = null;
    }

    private async ensureModel(modelPath: string): Promise<void> {
        if (this.disposeTimer) {
            clearTimeout(this.disposeTimer);
            this.disposeTimer = null;
        }
        if (this.activeModelPath === modelPath && this.model) {
            return;
        }
        await this.dispose();
        const llama = await getLlama();
        this.model = await llama.loadModel({ modelPath });
        this.activeModelPath = modelPath;
    }

    private scheduleDispose(): void {
        if (this.disposeTimer) {
            clearTimeout(this.disposeTimer);
        }
        this.disposeTimer = setTimeout(() => {
            void this.dispose();
        }, LocalRuntimeService.IDLE_DISPOSE_MS);
    }
}
