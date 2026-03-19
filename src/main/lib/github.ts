import {
    GITHUB_OWNER as DEFAULT_GITHUB_OWNER,
    GITHUB_REPO as DEFAULT_GITHUB_REPO,
    GITHUB_RELEASE_TAG as DEFAULT_GITHUB_RELEASE_TAG,
} from '@shared/constants';

function envOrDefault(value: string | undefined, fallback: string): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : fallback;
}

export const GITHUB_OWNER = envOrDefault(import.meta.env.VITE_GITHUB_OWNER, DEFAULT_GITHUB_OWNER);

export const GITHUB_REPO = envOrDefault(import.meta.env.VITE_GITHUB_REPO, DEFAULT_GITHUB_REPO);

export const GITHUB_RELEASE_TAG = envOrDefault(
    import.meta.env.VITE_GITHUB_RELEASE_TAG,
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

const GITHUB_API_BASE = 'https://api.github.com';

interface GitHubAsset {
    id: number;
    name: string;
    url: string;
}

let releaseAssetsCache: GitHubAsset[] | null = null;

/**
 * Fetch the list of assets for the configured release tag.
 * Cached after the first call.
 */
async function getReleaseAssets(): Promise<GitHubAsset[]> {
    if (releaseAssetsCache) return releaseAssetsCache;

    const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPOSITORY}/releases/tags/${GITHUB_RELEASE_TAG}`;
    const res = await githubFetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch release: ${res.status}`);
    }
    const release = (await res.json()) as { assets: GitHubAsset[] };
    releaseAssetsCache = release.assets ?? [];
    return releaseAssetsCache;
}

/**
 * Download a GitHub release asset by file name (works for private repos).
 *
 * 1. Resolves the asset ID via the GitHub API
 * 2. Requests the asset with `Accept: application/octet-stream` + auth
 * 3. GitHub returns a 302 redirect to a pre-signed S3 URL
 * 4. Downloads from S3 WITHOUT auth headers (S3 rejects them)
 */
export async function githubDownload(fileName: string): Promise<Response> {
    const assets = await getReleaseAssets();
    const asset = assets.find((a) => a.name === fileName);
    if (!asset) {
        return new Response(null, { status: 404, statusText: `Asset "${fileName}" not found` });
    }

    // Step 1: Request asset from API — don't follow redirect automatically
    const headers = new Headers();
    headers.set('Accept', 'application/octet-stream');
    headers.set('User-Agent', 'wmb-table');
    headers.set('X-GitHub-Api-Version', '2022-11-28');
    if (GITHUB_TOKEN) {
        headers.set('Authorization', `Bearer ${GITHUB_TOKEN}`);
    }

    const apiResponse = await fetch(asset.url, { headers, redirect: 'manual' });

    // Step 2: Follow redirect to S3 without auth headers
    if (apiResponse.status === 302 || apiResponse.status === 307) {
        const downloadUrl = apiResponse.headers.get('location');
        if (!downloadUrl) {
            return new Response(null, {
                status: 502,
                statusText: 'GitHub redirect missing Location header',
            });
        }
        return fetch(downloadUrl, {
            headers: { Accept: 'application/octet-stream', 'User-Agent': 'wmb-table' },
        });
    }

    // Direct response (200) — return as-is
    return apiResponse;
}
