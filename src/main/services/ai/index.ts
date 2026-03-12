import { AiService } from './ai.service';

let aiService: AiService | null = null;

export function getAiService(): AiService {
    if (!aiService) {
        aiService = new AiService();
    }
    return aiService;
}

export function disposeAiService(): void {
    aiService?.dispose();
    aiService = null;
}
