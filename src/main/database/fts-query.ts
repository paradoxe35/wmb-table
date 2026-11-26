/**
 * Turns free text into an FTS5 MATCH expression that cannot be a syntax error: every word
 * becomes a quoted phrase, so hyphens, apostrophes, colons and AND/OR/NOT/NEAR are plain text.
 * Returns an empty string when nothing searchable is left; FTS5 rejects an empty MATCH.
 */
export function sanitizeFtsQuery(raw: string): string {
    return raw
        .replace(/[\p{Cc}"(){}*:^~]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter((w) => w.length >= 2)
        .map((w) => `"${w}"`)
        .join(' ');
}
