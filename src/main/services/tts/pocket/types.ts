export interface PocketStateEntry {
    dtype: 'float32' | 'int64' | 'bool';
    fill?: 'nan' | 'ones' | 'zeros';
    index: number;
    input_name: string;
    output_name: string;
    key: string;
    module: string;
    path: string;
    shape: number[];
}

export interface PocketBundle {
    bundle_name: string;
    language: string;
    sample_rate: number;
    samples_per_frame: number;
    latent_dim: number;
    conditioning_dim: number;
    frame_rate: number;
    max_token_per_chunk: number;
    model_recommended_frames_after_eos?: number;
    insert_bos_before_voice?: boolean;
    pad_with_spaces_for_short_inputs?: boolean;
    remove_semicolons?: boolean;
    predefined_voices?: string[];
    bos_before_voice_file?: string;
    tokenizer_file: string;
    flow_lm_state_manifest: PocketStateEntry[];
    mimi_state_manifest: PocketStateEntry[];
}

export interface PocketTensor {
    data: Float32Array;
    shape: number[];
}
