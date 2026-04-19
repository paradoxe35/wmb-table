/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GITHUB_OWNER?: string;
    readonly VITE_GITHUB_REPO?: string;
    readonly VITE_GITHUB_RELEASE_TAG?: string;
    readonly MAIN_VITE_GITHUB_TOKEN?: string;
    readonly MAIN_VITE_GOOGLE_DRIVE_CREDENTIALS?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
