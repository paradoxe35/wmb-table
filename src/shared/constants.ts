export const GITHUB_OWNER = 'paradoxe35';
export const GITHUB_REPO = 'wmb-table';
export const GITHUB_RELEASE_TAG = 'v1.0.0';
export const GITHUB_REPOSITORY = `${GITHUB_OWNER}/${GITHUB_REPO}`;
export const GITHUB_REPO_LINK = `https://github.com/${GITHUB_REPOSITORY}`;
export const GITHUB_RELEASES_LINK = `${GITHUB_REPO_LINK}/releases`;

export function buildGitHubReleaseDownloadBase(tag = GITHUB_RELEASE_TAG): string {
    return `${GITHUB_RELEASES_LINK}/download/${tag}`;
}

export const GITHUB_RELEASE_DOWNLOAD_BASE = buildGitHubReleaseDownloadBase();

export const WEBSITE_LINK = 'https://wmb-table.web.app/';
export const DOCS_LINK = 'https://wmb-table.web.app/';
export const DOCS_SUBJECT_LINK = 'https://wmb-table.web.app/docs/features/subjects';
export const DOCS_NOTE_LINK = 'https://wmb-table.web.app/docs/features/notes';
export const DOCS_CUSTOM_DOCUMENT_LINK = 'https://wmb-table.web.app/docs/others/custom-documents';
