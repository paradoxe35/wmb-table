import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { downloadResumableFile } from '@main/lib/resumable-download';
import { BUNDLE_FILES, bundleFileUrl, voiceUrl } from './catalog';

export type InstallProgress = (percentage: number) => void;

/** The flow model dwarfs the rest, so progress is weighted by real size instead of file count. */
const FILE_WEIGHTS: Record<string, number> = {
    'flow_lm_main_int8.onnx': 0.75,
    'mimi_decoder_int8.onnx': 0.07,
    'mimi_encoder_int8.onnx': 0.06,
    'text_conditioner_int8.onnx': 0.05,
    'flow_lm_flow_int8.onnx': 0.04,
};

function weightOf(file: string): number {
    return FILE_WEIGHTS[file] ?? 0.01;
}

export function bundleDir(modelsDir: string, bundle: string): string {
    return join(modelsDir, bundle);
}

export function voiceFile(modelsDir: string, bundle: string, voice: string): string {
    return join(bundleDir(modelsDir, bundle), 'voices', `${voice}.safetensors`);
}

export function isBundleInstalled(modelsDir: string, bundle: string): boolean {
    const dir = bundleDir(modelsDir, bundle);
    return BUNDLE_FILES.every((file) => existsSync(join(dir, file)));
}

export async function installBundle(
    modelsDir: string,
    bundle: string,
    onProgress: InstallProgress,
): Promise<void> {
    const dir = bundleDir(modelsDir, bundle);
    await mkdir(dir, { recursive: true });

    const total = BUNDLE_FILES.reduce((sum, file) => sum + weightOf(file), 0);
    let completed = 0;

    for (const file of BUNDLE_FILES) {
        const weight = weightOf(file);
        await downloadResumableFile({
            url: bundleFileUrl(bundle, file),
            destinationPath: join(dir, file),
            reuseExistingFile: true,
            onProgress: ({ percentage }) => {
                onProgress(Math.round(((completed + (weight * percentage) / 100) / total) * 100));
            },
        });
        completed += weight;
        onProgress(Math.round((completed / total) * 100));
    }
}

export async function ensureVoice(
    modelsDir: string,
    bundle: string,
    voice: string,
): Promise<string> {
    const destination = voiceFile(modelsDir, bundle, voice);
    if (existsSync(destination)) return destination;

    await mkdir(join(bundleDir(modelsDir, bundle), 'voices'), { recursive: true });
    await downloadResumableFile({
        url: voiceUrl(bundle, voice),
        destinationPath: destination,
        reuseExistingFile: true,
    });
    return destination;
}
