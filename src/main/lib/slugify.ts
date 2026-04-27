const MAX_FILENAME_LENGTH = 80;

export function slugifyFilename(input: string, fallback = 'document'): string {
    const slug = input
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, MAX_FILENAME_LENGTH)
        .replace(/-+$/g, '');

    return slug || fallback;
}
