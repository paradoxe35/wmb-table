const CONTENTFUL_HTML_TAG_PATTERN =
    /<(img|video|audio|iframe|object|embed|svg|canvas|table|hr|ul|ol|li|blockquote|pre)\b/i;

export function hasMeaningfulHtmlContent(html?: string | null): boolean {
    if (!html) {
        return false;
    }

    const normalizedHtml = html
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');

    if (CONTENTFUL_HTML_TAG_PATTERN.test(normalizedHtml)) {
        return true;
    }

    const textContent = normalizedHtml
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z0-9#]+;/gi, ' ')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return textContent.length > 0;
}
