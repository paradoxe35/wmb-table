import { readdir, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { getAiModelsDir } from '@main/lib/app-paths';
import type { AiLocalModelInfo, AiModelScanResult, AiSupportedLocalModel } from '@shared/ai.types';
import { KNOWN_LOCAL_MODELS } from './known-models';

function detectKnownModel(fileName: string) {
    const normalized = fileName.toLowerCase();
    return KNOWN_LOCAL_MODELS.find((model) => {
        return model.aliases.some((alias) => {
            return normalized.includes(alias.toLowerCase());
        });
    });
}

export async function scanLocalModels(): Promise<AiModelScanResult> {
    const scannedPath = getAiModelsDir();
    const entries = await readdir(scannedPath, { withFileTypes: true }).catch(() => {
        return [];
    });
    const files = entries.filter((entry) => {
        return entry.isFile() && extname(entry.name) === '.gguf';
    });

    const models = await Promise.all(
        files.map(async (entry): Promise<AiLocalModelInfo> => {
            const localPath = join(scannedPath, entry.name);
            const fileStat = await stat(localPath);
            const known = detectKnownModel(entry.name);
            return {
                id: known?.id ?? basename(entry.name, '.gguf'),
                name: known?.name ?? basename(entry.name, '.gguf'),
                family: known?.family ?? 'other',
                fileName: entry.name,
                quantization: known?.quantization ?? 'GGUF',
                sizeBytes: fileStat.size,
                downloaded: true,
                localPath,
                recommended: known?.recommended ?? false,
                contextSize: known?.contextSize,
            };
        }),
    );

    const sortedModels = models.sort((a, b) => {
        return Number(b.recommended) - Number(a.recommended) || a.name.localeCompare(b.name);
    });
    const supportedModels = KNOWN_LOCAL_MODELS.map((known): AiSupportedLocalModel => {
        const installedModel =
            sortedModels.find((model) => {
                return model.id === known.id;
            }) ?? null;

        return {
            id: known.id,
            name: known.name,
            family: known.family,
            description: known.description,
            quantization: known.quantization,
            recommended: known.recommended,
            downloadUrl: known.downloadUrl,
            approximateSizeMb: known.approximateSizeMb,
            installed: installedModel != null,
            installedModel: installedModel ?? undefined,
        };
    });

    return {
        models: sortedModels,
        supportedModels,
        scannedPath,
    };
}

export async function resolveAutoSelectedLocalModel(
    selectedModel: string | null | undefined,
): Promise<AiLocalModelInfo | null> {
    const { models } = await scanLocalModels();
    if (models.length === 0) return null;
    if (selectedModel) {
        return (
            models.find((model) => {
                return model.id === selectedModel || model.fileName === selectedModel;
            }) ?? null
        );
    }
    if (models.length === 1) return models[0];
    return (
        models.find((model) => {
            return model.recommended;
        }) ?? models[0]
    );
}
