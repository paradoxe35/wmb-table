import { Marked } from 'marked';
import i18n from '@main/lib/i18n';
import { escapeHtml } from '@shared/searchable';
import type { AiConversation, AiMessage } from '@shared/ai.types';

const aiChatMarkdown = new Marked({
    renderer: {
        html({ text }) {
            return escapeHtml(text);
        },
        link({ href, tokens, title }) {
            const text = this.parser.parseInline(tokens);
            if (
                href.startsWith('wmb://') ||
                href.startsWith('http://w.t') ||
                href.startsWith('https://w.t')
            ) {
                return `<span class="reference-link">${text}</span>`;
            }

            const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
            return `<a href="${escapeHtml(href)}"${titleAttr}>${text}</a>`;
        },
    },
});

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

function isMeaningfulMessage(message: AiMessage): boolean {
    return (
        message.content.trim().length > 0 ||
        message.toolCalls.length > 0 ||
        message.toolResults.length > 0
    );
}

async function renderAssistantContent(content: string): Promise<string> {
    if (!content.trim()) {
        return '';
    }

    const html = await aiChatMarkdown.parse(sanitizeWmbLinks(content));
    return html;
}

async function renderMessage(message: AiMessage): Promise<string> {
    const roleLabel = message.role === 'user' ? i18n.t('Vous') : i18n.t('Assistant');

    if (message.role === 'user') {
        return `<article class="message message--user">
  <div class="message-role">${escapeHtml(roleLabel)}</div>
  <div class="message-body message-body--plain">${escapeHtml(message.content)}</div>
</article>`;
    }

    const contentHtml = await renderAssistantContent(message.content);

    return `<article class="message message--assistant">
  <div class="message-role">${escapeHtml(roleLabel)}</div>
  <div class="message-body message-body--markdown">${contentHtml || `<p class="message-empty">${escapeHtml(i18n.t('Réponse sans texte'))}</p>`}</div>
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
  body { margin: 0; font-family: Georgia, "Times New Roman", serif; background: #ffffff; color: #1f2937; }
  .page { max-width: 760px; margin: 0 auto; padding: 36px 34px 44px; }
  .header { border-bottom: 1px solid #d6d9de; padding-bottom: 18px; margin-bottom: 24px; }
  h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.25; font-weight: 700; color: #111827; }
  .header-meta { color: #6b7280; font-size: 12px; }
  .transcript { display: flex; flex-direction: column; gap: 18px; }
  .message { page-break-inside: avoid; }
  .message-role { margin-bottom: 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #4b5563; }
  .message--user { padding-left: 14px; border-left: 3px solid #d7dee8; }
  .message--assistant { padding-left: 14px; border-left: 3px solid #d9c7a3; }
  .message-body { font-size: 14px; line-height: 1.75; color: #1f2937; }
  .message-body--plain { white-space: pre-wrap; }
  .message-body p:first-child { margin-top: 0; }
  .message-body p:last-child { margin-bottom: 0; }
  .message-body pre { background: #f4f4f5; color: #111827; padding: 12px 14px; border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; white-space: pre-wrap; word-break: break-word; }
  .message-body code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 12px; }
  .message-body blockquote { margin: 14px 0; padding-left: 14px; border-left: 3px solid #d6dde6; color: #4b5563; }
  .message-body table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px; }
  .message-body th, .message-body td { border: 1px solid #d8dee7; padding: 8px 10px; text-align: left; vertical-align: top; }
  .message-body a, .reference-link { color: #1f4b99; text-decoration: none; }
  .message-empty { color: #6b7280; font-style: italic; }
</style>
</head>
<body>
  <main class="page">
    <header class="header">
      <h1>${escapeHtml(title)}</h1>
      <div class="header-meta">${escapeHtml(i18n.t('Créé le'))}: ${escapeHtml(formatDateTime(conversation.createdAt))}</div>
    </header>
    <section class="transcript">
      ${renderedMessages.join('\n')}
    </section>
  </main>
</body>
</html>`;
}
