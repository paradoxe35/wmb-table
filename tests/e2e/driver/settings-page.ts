import type { CdpSession } from './cdp';

const MENU = {
    settings: '[data-menu-id$="settings"]',
    history: '[data-menu-id$="history"]',
};

/** Drives the real Settings view with mouse and keyboard events. */
export class SettingsPage {
    private readonly cdp: CdpSession;

    constructor(cdp: CdpSession) {
        this.cdp = cdp;
    }

    async openTab(tabKey: 'ai' | 'tts'): Promise<void> {
        await this.openSettings();
        // The tab strip can overflow behind the side panel in a narrow window: a DOM click still
        // goes through the tab's own handler.
        await this.cdp.waitFor(
            `(() => {
                const tab = document.querySelector('.settings-page__tabs [data-node-key="${tabKey}"] .ant-tabs-tab-btn');
                tab?.click();
                return Boolean(tab);
            })()`,
            `${tabKey} tab button`,
        );
        await this.cdp.waitFor(
            `Boolean(document.querySelector('.settings-page__tabs [data-node-key="${tabKey}"].ant-tabs-tab-active'))`,
            `${tabKey} tab`,
        );
    }

    /** The sidebar can still move while the window finishes loading, so retry the click. */
    private async openSettings(): Promise<void> {
        for (let attempt = 1; ; attempt++) {
            await this.click(MENU.settings);
            try {
                await this.cdp.waitFor(
                    `!document.querySelector('.settings__option__content').classList.contains('view-panel--hidden')`,
                    'settings page',
                    3_000,
                );
                return;
            } catch (error) {
                if (attempt >= 5) throw error;
            }
        }
    }

    async leaveSettings(): Promise<void> {
        await this.click(MENU.history);
        await this.cdp.waitFor(
            `document.querySelector('.settings__option__content').classList.contains('view-panel--hidden')`,
            'settings hidden',
        );
    }

    async click(selector: string): Promise<void> {
        await this.clickFirst(selector, null);
    }

    /** Clicks the first visible element matching `selector` whose text includes `text`. */
    async clickText(selector: string, text: string): Promise<void> {
        await this.clickFirst(selector, text);
    }

    /** Waits until the element stops moving (popups animate in), then clicks its centre. */
    private async clickFirst(selector: string, text: string | null): Promise<void> {
        const locate = `(() => {
            const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(
                (node) => node.getBoundingClientRect().width > 0 &&
                    (${JSON.stringify(text)} === null || node.textContent.includes(${JSON.stringify(text)})),
            );
            if (!el) return null;
            el.scrollIntoView({ block: 'center' });
            const rect = el.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        })()`;
        const label = `visible ${selector}${text === null ? '' : ` with "${text}"`}`;
        let point = await this.cdp.waitFor<{ x: number; y: number }>(locate, label);
        for (let i = 0; i < 20; i++) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const next = await this.cdp.waitFor<{ x: number; y: number }>(locate, label);
            if (next.x === point.x && next.y === point.y) break;
            point = next;
        }
        await this.clickAt(point);
    }

    async selectOption(selectId: string, optionText: string): Promise<void> {
        await this.click(`.ant-select:has(#${selectId})`);
        await this.clickText(
            '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
            optionText,
        );
    }

    /** Replaces the field's text in one input event, like a paste. */
    async paste(selector: string, text: string): Promise<void> {
        await this.focusAndSelect(selector);
        await this.cdp.send('Input.insertText', { text });
    }

    /** Replaces the field's text one character at a time, `gapMs` apart. */
    async type(selector: string, text: string, gapMs: number): Promise<void> {
        await this.focusAndSelect(selector);
        for (const char of text) {
            await this.cdp.send('Input.insertText', { text: char });
            await new Promise((resolve) => setTimeout(resolve, gapMs));
        }
    }

    async pressTab(): Promise<void> {
        const key = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 };
        await this.cdp.send('Input.dispatchKeyEvent', { ...key, type: 'keyDown' });
        await this.cdp.send('Input.dispatchKeyEvent', { ...key, type: 'keyUp' });
    }

    value(selector: string): Promise<string | null> {
        return this.cdp.evaluate(
            `document.querySelector(${JSON.stringify(selector)})?.value ?? null`,
        );
    }

    text(selector: string): Promise<string[]> {
        return this.cdp.evaluate(
            `[...document.querySelectorAll(${JSON.stringify(selector)})].map((el) => el.innerText.trim())`,
        );
    }

    async clear(selector: string): Promise<void> {
        await this.focusAndSelect(selector);
        await this.cdp.send('Input.dispatchKeyEvent', {
            type: 'keyDown',
            key: 'Backspace',
            code: 'Backspace',
            windowsVirtualKeyCode: 8,
        });
        await this.cdp.send('Input.dispatchKeyEvent', {
            type: 'keyUp',
            key: 'Backspace',
            code: 'Backspace',
            windowsVirtualKeyCode: 8,
        });
    }

    private async focusAndSelect(selector: string): Promise<void> {
        await this.click(selector);
        await this.cdp.evaluate(`document.querySelector(${JSON.stringify(selector)}).select()`);
    }

    private async clickAt(point: { x: number; y: number }): Promise<void> {
        const mouse = { ...point, button: 'left', clickCount: 1 };
        await this.cdp.send('Input.dispatchMouseEvent', { ...mouse, type: 'mouseMoved' });
        // Select options re-render on hover; pressing at once can hit the node being replaced.
        await new Promise((resolve) => setTimeout(resolve, 80));
        await this.cdp.send('Input.dispatchMouseEvent', { ...mouse, type: 'mousePressed' });
        await this.cdp.send('Input.dispatchMouseEvent', { ...mouse, type: 'mouseReleased' });
    }
}
