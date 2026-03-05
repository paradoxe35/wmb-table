export async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
    const { extractText } = await import('unpdf');
    const { text } = await extractText(pdfBytes);
    return text;
}
