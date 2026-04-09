import { marked } from 'marked';
import i18n from '@main/lib/i18n';
import { escapeHtml } from '@shared/searchable';
import type { AiConversation, AiMessage, AiToolResult } from '@shared/ai.types';

interface GroupedToolResult {
    name: string;
    count: number;
}

function formatDateTime(isoDate: string): string {
    return new Date(isoDate).toLocaleString(i18n.language, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function sanitizeWmbLinks(content: string): string {
    return content
        .replace(/`(\[[^\]]+\]\(wmb:\/\/[^)]+\))`/g, '$1')
        .replace(
            /\]\(wmb:\/\/([^)]+)\)/g,
            (_, path: string) => `](http://w.t/#wmb/${path.replace(/ /g, '%20')})`,
        );
}

function convertWmbHrefLinks(html: string): string {
    return html.replace(
        /href="wmb:\/\/([^"]+)"/g,
        (_, path: string) => `href="http://w.t/#wmb/${path}"`,
    );
}

function sanitizeRenderedHtml(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '')
        .replace(/\son\w+='[^']*'/gi, '')
        .replace(/javascript:/gi, '');
}

function groupToolResults(results: AiToolResult[]): GroupedToolResult[] {
    const counts = new Map<string, number>();
    for (const result of results) {
        counts.set(result.name, (counts.get(result.name) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

function isMeaningfulMessage(message: AiMessage): boolean {
    return (
        message.content.trim().length > 0 ||
        message.toolCalls.length > 0 ||
        message.toolResults.length > 0
    );
}

function renderToolResults(results: AiToolResult[]): string {
    if (results.length === 0) {
        return '';
    }

    const items = groupToolResults(results)
        .map(
            (result) =>
                `<span class="tool-tag">${escapeHtml(result.name)}${result.count > 1 ? ` ×${result.count}` : ''}</span>`,
        )
        .join('\n');

    return `<div class="tool-results">${items}</div>`;
}

async function renderAssistantContent(content: string): Promise<string> {
    if (!content.trim()) {
        return '';
    }

    const html = await marked.parse(sanitizeWmbLinks(content));
    return sanitizeRenderedHtml(convertWmbHrefLinks(html));
}

async function renderMessage(message: AiMessage): Promise<string> {
    const roleClass = message.role === 'user' ? 'user' : 'assistant';
    const roleLabel = message.role === 'user' ? i18n.t('Vous') : i18n.t('Assistant');
    const toolResults = renderToolResults(message.toolResults);

    if (message.role === 'user') {
        return `<article class="message-card message-card--${roleClass}">
  <div class="message-meta">
    <span class="message-role">${escapeHtml(roleLabel)}</span>
    <time>${escapeHtml(formatDateTime(message.createdAt))}</time>
  </div>
  <div class="message-body message-body--plain">${escapeHtml(message.content)}</div>
  ${toolResults}
</article>`;
    }

    const contentHtml = await renderAssistantContent(message.content);

    return `<article class="message-card message-card--${roleClass}">
  <div class="message-meta">
    <span class="message-role">${escapeHtml(roleLabel)}</span>
    <time>${escapeHtml(formatDateTime(message.createdAt))}</time>
  </div>
  <div class="message-body message-body--markdown">${contentHtml || `<p class="message-empty">${escapeHtml(i18n.t('Réponse sans texte'))}</p>`}</div>
  ${toolResults}
</article>`;
}

export function hasExportableConversationContent(messages: AiMessage[]): boolean {
    return messages.some(isMeaningfulMessage);
}

export async function buildAiConversationExportHtml(
    conversation: AiConversation,
    messages: AiMessage[],
): Promise<string> {
    const visibleMessages = messages.filter(isMeaningfulMessage);
    const renderedMessages = await Promise.all(
        visibleMessages.map((message) => renderMessage(message)),
    );
    const title = conversation.title?.trim() || i18n.t('Conversation');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f4f1ea; color: #1f2937; }
  .page { max-width: 860px; margin: 0 auto; padding: 32px 24px 40px; }
  .header { padding: 28px; border-radius: 22px; background: linear-gradient(135deg, #fffaf0 0%, #ffffff 100%); border: 1px solid #eadfcb; }
  .eyebrow { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #efe4d1; color: #8a5a24; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
  h1 { margin: 14px 0 10px; font-size: 28px; line-height: 1.2; color: #111827; }
  .header-meta { display: flex; flex-wrap: wrap; gap: 12px 18px; color: #6b7280; font-size: 12px; }
  .timeline { margin-top: 22px; display: flex; flex-direction: column; gap: 14px; }
  .message-card { border-radius: 18px; padding: 18px 18px 16px; page-break-inside: avoid; }
  .message-card--user { background: #fffaf3; border: 1px solid #efd9bd; }
  .message-card--assistant { background: #ffffff; border: 1px solid #dfe6ee; }
  .message-meta { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; font-size: 12px; color: #6b7280; }
  .message-role { font-weight: 700; color: #111827; }
  .message-body { font-size: 14px; line-height: 1.7; color: #1f2937; }
  .message-body--plain { white-space: pre-wrap; }
  .message-body p:first-child { margin-top: 0; }
  .message-body p:last-child { margin-bottom: 0; }
  .message-body pre { background: #111827; color: #f9fafb; padding: 14px; border-radius: 12px; overflow: hidden; white-space: pre-wrap; word-break: break-word; }
  .message-body code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 12px; }
  .message-body blockquote { margin: 14px 0; padding-left: 14px; border-left: 3px solid #d6dde6; color: #4b5563; }
  .message-body table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px; }
  .message-body th, .message-body td { border: 1px solid #d8dee7; padding: 8px 10px; text-align: left; vertical-align: top; }
  .message-body a { color: #0f766e; text-decoration: none; }
  .message-empty { color: #6b7280; font-style: italic; }
  .tool-results { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .tool-tag { display: inline-flex; align-items: center; border-radius: 999px; background: #edf2f7; color: #475569; padding: 4px 10px; font-size: 11px; font-weight: 600; }
</style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div class="eyebrow">${escapeHtml(i18n.t('Assistant IA'))}</div>
      <h1>${escapeHtml(title)}</h1>
      <div class="header-meta">
        <span>${escapeHtml(i18n.t('Créé le'))}: ${escapeHtml(formatDateTime(conversation.createdAt))}</span>
        <span>${escapeHtml(i18n.t('Mis à jour le'))}: ${escapeHtml(formatDateTime(conversation.updatedAt))}</span>
        <span>${escapeHtml(i18n.t('Exporté le'))}: ${escapeHtml(formatDateTime(new Date().toISOString()))}</span>
      </div>
    </header>
    <section class="timeline">
      ${renderedMessages.join('\n')}
    </section>
  </main>
</body>
</html>`;
}
