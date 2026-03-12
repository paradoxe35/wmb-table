import {
    GITHUB_OWNER as DEFAULT_GITHUB_OWNER,
    GITHUB_REPO as DEFAULT_GITHUB_REPO,
    GITHUB_RELEASE_TAG as DEFAULT_GITHUB_RELEASE_TAG,
} from '@shared/constants';

function envOrDefault(value: string | undefined, fallback: string): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : fallback;
}

export const GITHUB_OWNER = envOrDefault(
    import.meta.env.MAIN_VITE_GITHUB_OWNER,
    DEFAULT_GITHUB_OWNER,
);

export const GITHUB_REPO = envOrDefault(import.meta.env.MAIN_VITE_GITHUB_REPO, DEFAULT_GITHUB_REPO);

export const GITHUB_RELEASE_TAG = envOrDefault(
    import.meta.env.MAIN_VITE_GITHUB_RELEASE_TAG,
    DEFAULT_GITHUB_RELEASE_TAG,
);

export const GITHUB_TOKEN = import.meta.env.MAIN_VITE_GITHUB_TOKEN?.trim() || '';
export const GITHUB_REPOSITORY = `${GITHUB_OWNER}/${GITHUB_REPO}`;
export const GITHUB_REPO_LINK = `https://github.com/${GITHUB_REPOSITORY}`;
export const GITHUB_RELEASES_LINK = `${GITHUB_REPO_LINK}/releases`;
export const GITHUB_RELEASE_DOWNLOAD_BASE = `${GITHUB_RELEASES_LINK}/download/${GITHUB_RELEASE_TAG}`;

export function githubHeaders(extra?: RequestInit['headers']): Headers {
    const headers = new Headers(extra);
    headers.set('Accept', 'application/vnd.github+json');
    headers.set('X-GitHub-Api-Version', '2022-11-28');
    headers.set('User-Agent', 'wmb-table');
    if (GITHUB_TOKEN) {
        headers.set('Authorization', `Bearer ${GITHUB_TOKEN}`);
    }
    return headers;
}

export function githubFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
    return fetch(input, {
        ...init,
        headers: githubHeaders(init.headers),
    });
}
