declare module 'sentencex-wasm' {
    interface SentenceBoundary {
        start_index: number;
        end_index: number;
        text: string;
        boundary_symbol: string | null;
        is_paragraph_break: boolean;
    }

    export function initSync(options: { module: BufferSource }): void;
    export function segment(language: string, text: string): string[];
    export function get_sentence_boundaries(language: string, text: string): SentenceBoundary[];
}
