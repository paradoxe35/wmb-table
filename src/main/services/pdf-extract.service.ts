/**
 * Extract structured paragraphs from a PDF.
 *
 * Strategy:
 * 1. Extract text per-page (preserves page boundaries)
 * 2. Merge short broken lines (PDF line wraps) into full sentences
 * 3. Detect real paragraph breaks (blank lines, indentation, sentence endings)
 * 4. Return clean paragraph array as JSON string for storage
 */
export async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
    const { extractText } = await import('unpdf');
    const { text: pages } = await extractText(pdfBytes, { mergePages: false });

    const paragraphs = buildParagraphs(pages);

    // Store as JSON array of paragraphs
    return JSON.stringify(paragraphs);
}

/**
 * Merge raw per-page text lines into clean paragraphs.
 *
 * PDF text extraction often breaks lines at arbitrary column widths,
 * includes hyphenation, and mixes page headers/footers into the flow.
 * This function reconstructs readable paragraphs from that raw output.
 */
export function buildParagraphs(pages: string[]): string[] {
    const paragraphs: string[] = [];

    for (const pageText of pages) {
        const lines = pageText.split('\n');
        let current = '';

        for (const rawLine of lines) {
            const line = rawLine.trim();

            // Empty lines signal paragraph breaks
            if (!line) {
                if (current) {
                    paragraphs.push(current.trim());
                    current = '';
                }
                continue;
            }

            // Heuristic: if the previous chunk ends with sentence-ending punctuation
            // and this line starts with uppercase, it's likely a new paragraph
            if (current && /[.!?:»"]\s*$/.test(current) && /^[A-ZÀ-ÖØ-Þ0-9«"]/.test(line)) {
                paragraphs.push(current.trim());
                current = line;
                continue;
            }

            // Join with a space (merge broken lines)
            if (current) {
                // If previous line ended with a hyphen, merge without space (hyphenation)
                if (current.endsWith('-')) {
                    current = current.slice(0, -1) + line;
                } else {
                    current += ' ' + line;
                }
            } else {
                current = line;
            }
        }

        // Flush remaining text at end of page
        if (current) {
            paragraphs.push(current.trim());
            current = '';
        }
    }

    // Filter out very short fragments (likely headers/footers/page numbers)
    return paragraphs.filter((p) => p.length > 2);
}
