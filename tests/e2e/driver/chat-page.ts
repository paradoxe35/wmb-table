import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CdpSession } from './cdp';

export type Theme = 'light' | 'dark';

export interface ChatMessageFact {
    role: 'user' | 'assistant';
    text: string;
}

/** What a user can see in the chat view at one moment. */
export interface ChatFacts {
    messages: ChatMessageFact[];
    errorAlerts: string[];
    toolTags: string[];
    reasoningBlocks: number;
    stopButton: boolean;
    sendButtonEnabled: boolean;
    retryButtons: number;
    typingIndicator: boolean;
    spinner: boolean;
    conversationTitles: string[];
    activeTitle: string | null;
    theme: string | null;
}

const SELECTORS = {
    chatView: '.ai-chat',
    menuItem: '[data-menu-id$="ai-chat"]',
    newConversation: 'button.ai-chat__new-conversation',
    input: 'textarea.ai-chat__input-textarea',
    stop: 'button.ai-chat__stop-button',
    send: 'button.ai-chat__send-button',
};

/** The "new conversation" label differs in every language, unlike "Envoyer" (es and pt: "Enviar"). */
const NEW_CONVERSATION_LABELS: Record<string, string> = {
    fr: 'Nouvelle conversation',
    en: 'New conversation',
    es: 'Nueva conversación',
    pt: 'Nova conversa',
    sw: 'Mazungumzo mapya',
};

const READ_FACTS = `(() => {
    const texts = (selector) => [...document.querySelectorAll(selector)].map((el) => el.innerText.trim());
    const send = document.querySelector(${JSON.stringify(SELECTORS.send)});
    return {
        messages: [...document.querySelectorAll('.ai-chat__bubble')].map((bubble) => ({
            role: bubble.classList.contains('ai-chat__bubble--user') ? 'user' : 'assistant',
            text: (bubble.querySelector('.ai-chat__bubble-content')?.innerText ?? '').trim(),
        })),
        errorAlerts: texts('.ai-chat .ant-alert-error'),
        toolTags: texts('.ai-chat__tool-results .ant-tag'),
        reasoningBlocks: document.querySelectorAll('.ai-chat .ai-reasoning').length,
        stopButton: Boolean(document.querySelector(${JSON.stringify(SELECTORS.stop)})),
        sendButtonEnabled: Boolean(send && !send.disabled),
        retryButtons: document.querySelectorAll('.ai-chat__retry-button').length,
        typingIndicator: Boolean(document.querySelector('.ai-chat__typing-indicator')),
        spinner: Boolean(document.querySelector('.ai-chat__bubble .ant-spin')),
        conversationTitles: texts('.ai-chat__conv-title'),
        activeTitle: document.querySelector('.ai-chat__header-title-text')?.innerText.trim() ?? null,
        theme: document.documentElement.getAttribute('data-theme'),
    };
})()`;

export class ChatPage {
    private readonly cdp: CdpSession;
    private readonly screenshotDir: string;

    constructor(cdp: CdpSession, screenshotDir: string) {
        this.cdp = cdp;
        this.screenshotDir = screenshotDir;
        mkdirSync(screenshotDir, { recursive: true });
    }

    async open(): Promise<void> {
        await this.cdp.waitFor(
            `Boolean(document.querySelector('${SELECTORS.menuItem}'))`,
            'assistant menu',
        );
        await this.click(SELECTORS.menuItem);
        await this.cdp.waitFor(
            `Boolean(document.querySelector('${SELECTORS.input}'))`,
            'chat input',
        );
    }

    /**
     * Opens an empty conversation with no banner. The app reuses an empty conversation instead of
     * creating another, so the list only grows when the open one had messages.
     */
    async startNewConversation(): Promise<void> {
        const before = await this.facts();
        const mustGrow = before.messages.length > 0;
        await this.click(SELECTORS.newConversation);
        await this.cdp.waitFor(
            `document.querySelectorAll('.ai-chat__bubble').length === 0 && (${!mustGrow} || document.querySelectorAll('.ai-chat__conv-title').length > ${before.conversationTitles.length})`,
            'a new empty conversation',
        );
        await this.dismissErrorBanner();
    }

    private async dismissErrorBanner(): Promise<void> {
        const closeButton = `document.querySelector('.ai-chat .ant-alert-error .ant-alert-close-icon')`;
        if (!(await this.cdp.evaluate<boolean>(`Boolean(${closeButton})`))) return;
        await this.clickAt(closeButton, 'the error banner close button');
        await this.cdp.waitFor(
            `!document.querySelector('.ai-chat .ant-alert-error')`,
            'the error banner to close',
        );
    }

    /** Types into the real textarea and presses Enter, as a user would. */
    async send(message: string): Promise<void> {
        await this.click(SELECTORS.input);
        await this.cdp.send('Input.insertText', { text: message });
        await this.cdp.waitFor(
            `document.querySelector('${SELECTORS.input}').value === ${JSON.stringify(message)}`,
            'typed message',
        );
        await this.pressEnter();
        await this.cdp.waitFor(
            `document.querySelector('${SELECTORS.input}').value === ''`,
            'message accepted',
        );
    }

    async clickStop(): Promise<void> {
        await this.click(SELECTORS.stop);
    }

    /** Leaves the chat idle after a failed case, so the next case starts clean. */
    async stopIfRunning(): Promise<void> {
        if (!(await this.facts()).stopButton) return;
        await this.clickStop();
        await this.waitForFacts((facts) => !facts.stopButton, 'the run to stop', 15_000);
    }

    evaluate<T>(expression: string): Promise<T> {
        return this.cdp.evaluate<T>(expression);
    }

    /** Clicks, with a real mouse event, the innermost element of the last answer showing `text`. */
    async clickInLastAnswer(text: string): Promise<void> {
        await this.clickAt(
            `(() => {
                const bubbles = document.querySelectorAll('.ai-chat__bubble:not(.ai-chat__bubble--user)');
                const answer = bubbles[bubbles.length - 1];
                const matches = [...(answer?.querySelectorAll('*') ?? [])].filter(
                    (el) => el.textContent.trim() === ${JSON.stringify(text)},
                );
                return matches[matches.length - 1] ?? null;
            })()`,
            `"${text}" in the last answer`,
        );
    }

    /** Types and presses Enter without waiting for the input to clear (for refused messages). */
    async typeAndPressEnter(message: string): Promise<void> {
        await this.click(SELECTORS.input);
        await this.cdp.send('Input.insertText', { text: message });
        await this.pressEnter();
    }

    /** Selects the whole draft and deletes it, as a user would. */
    async clearInput(): Promise<void> {
        await this.click(SELECTORS.input);
        await this.cdp.evaluate(`document.querySelector('${SELECTORS.input}').select()`);
        const key = { key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 };
        await this.cdp.send('Input.dispatchKeyEvent', { ...key, type: 'keyDown' });
        await this.cdp.send('Input.dispatchKeyEvent', { ...key, type: 'keyUp' });
        await this.cdp.waitFor(
            `document.querySelector('${SELECTORS.input}').value === ''`,
            'an empty input',
        );
    }

    /** Clicks a button of the outcome banner by its visible label. */
    async clickNoticeButton(label: string): Promise<void> {
        await this.clickAt(
            `[...document.querySelectorAll('.ai-chat__run-notice button')].find((b) => b.innerText.trim() === ${JSON.stringify(label)}) ?? null`,
            `the "${label}" banner button`,
        );
    }

    /** Opens the conversation whose title contains `text`. */
    async openConversation(text: string): Promise<void> {
        await this.clickAt(
            `[...document.querySelectorAll('.ai-chat__conv-title')].find((el) => el.innerText.includes(${JSON.stringify(text)})) ?? null`,
            `the conversation "${text}"`,
        );
    }

    /** Clicks, with a real mouse event, the element `elementExpression` evaluates to. */
    async clickElement(elementExpression: string, label: string): Promise<void> {
        await this.clickAt(elementExpression, label);
    }

    /** Types into the focused element, as a user would. */
    async insertText(text: string): Promise<void> {
        await this.cdp.send('Input.insertText', { text });
    }

    noticeTexts(): Promise<string[]> {
        return this.cdp.evaluate<string[]>(
            `[...document.querySelectorAll('.ai-chat__run-notice')].map((el) => el.innerText.trim())`,
        );
    }

    /** Switches the UI language the way the settings do, then reloads and reopens the chat. */
    async setUiLanguage(language: string): Promise<void> {
        const shown = `document.querySelector('${SELECTORS.newConversation}')?.getAttribute('aria-label') === ${JSON.stringify(NEW_CONVERSATION_LABELS[language])}`;
        // The old page sometimes saves its own language again while it unloads, so try again
        for (let attempt = 1; ; attempt++) {
            await this.cdp.evaluate(`(async () => {
                await window.api.app.setUiLanguage(${JSON.stringify(language)});
                const stored = JSON.parse(localStorage.getItem('wmb-theme') ?? '{"state":{}}');
                stored.state.uiLanguagePreference = ${JSON.stringify(language)};
                localStorage.setItem('wmb-theme', JSON.stringify(stored));
            })()`);
            await this.cdp.reload();
            await this.open();
            try {
                await this.cdp.waitFor(shown, `the chat in "${language}"`, 8000);
                break;
            } catch (error) {
                if (attempt === 3) throw error;
            }
        }
        // After a reload the app may take main's theme while the emulated media is unchanged
        await this.cdp.send('Emulation.setEmulatedMedia', {
            features: [{ name: 'prefers-color-scheme', value: 'dark' }],
        });
        await this.waitForPaint();
        await this.setTheme('light');
    }

    /** Waits for a paint, because mouse events sent before the new layout get lost. */
    async setViewport(width: number, height: number): Promise<void> {
        await this.cdp.send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await this.waitForPaint();
    }

    async resetViewport(): Promise<void> {
        await this.cdp.send('Emulation.clearDeviceMetricsOverride', {});
        await this.waitForPaint();
    }

    facts(): Promise<ChatFacts> {
        return this.cdp.evaluate<ChatFacts>(READ_FACTS);
    }

    /** Waits until `predicate` holds for the visible facts, and returns them. */
    async waitForFacts(
        predicate: (facts: ChatFacts) => boolean,
        label: string,
        timeoutMs = 60_000,
    ): Promise<ChatFacts> {
        const deadline = Date.now() + timeoutMs;
        let facts = await this.facts();
        while (!predicate(facts)) {
            if (Date.now() > deadline) {
                throw new Error(
                    `Timed out after ${timeoutMs} ms waiting for ${label}. Last facts: ${JSON.stringify(facts).slice(0, 1500)}`,
                );
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
            facts = await this.facts();
        }
        return facts;
    }

    async setTheme(theme: Theme): Promise<void> {
        await this.cdp.send('Emulation.setEmulatedMedia', {
            features: [{ name: 'prefers-color-scheme', value: theme }],
        });
        await this.cdp.waitFor(
            `document.documentElement.getAttribute('data-theme') === '${theme}'`,
            `${theme} theme`,
        );
    }

    /** Emulated media set before a reload stops firing change events after it, so drop it first. */
    async reload(): Promise<void> {
        await this.cdp.send('Emulation.setEmulatedMedia', { features: [] });
        await this.cdp.reload();
        await this.open();
        await this.setTheme('light');
    }

    /** Saves `<name>-light.png` and `<name>-dark.png`, and returns to the light theme. */
    async screenshotBothThemes(name: string): Promise<string[]> {
        const paths: string[] = [];
        for (const theme of ['light', 'dark'] as const) {
            await this.setTheme(theme);
            await this.waitForPaint();
            const path = join(this.screenshotDir, `${name}-${theme}.png`);
            writeFileSync(path, await this.cdp.screenshot());
            paths.push(path);
        }
        await this.setTheme('light');
        return paths;
    }

    /** Ant Design animates colour changes, so wait past its transitions before a screenshot. */
    private async waitForPaint(): Promise<void> {
        await this.cdp.evaluate(
            'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 350))))',
        );
    }

    private async click(selector: string): Promise<void> {
        await this.clickAt(
            `document.querySelector(${JSON.stringify(selector)})`,
            `visible ${selector}`,
        );
    }

    private async clickAt(elementExpression: string, label: string): Promise<void> {
        const box = await this.cdp.waitFor<{ x: number; y: number }>(
            `(() => {
                const el = ${elementExpression};
                if (!el) return null;
                const rect = el.getBoundingClientRect();
                return rect.width > 0 ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
            })()`,
            label,
        );
        const mouse = { x: box.x, y: box.y, button: 'left', clickCount: 1 };
        await this.cdp.send('Input.dispatchMouseEvent', { ...mouse, type: 'mouseMoved' });
        await this.cdp.send('Input.dispatchMouseEvent', { ...mouse, type: 'mousePressed' });
        await this.cdp.send('Input.dispatchMouseEvent', { ...mouse, type: 'mouseReleased' });
    }

    private async pressEnter(): Promise<void> {
        const key = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 };
        await this.cdp.send('Input.dispatchKeyEvent', { ...key, type: 'keyDown', text: '\r' });
        await this.cdp.send('Input.dispatchKeyEvent', { ...key, type: 'keyUp' });
    }
}
