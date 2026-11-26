import type { CaseContext, E2eCase } from './case-runner';
import { MOCK_PROVIDER_ID } from './driver/app-setup';

const SETTINGS_MENU = `document.querySelector('[data-menu-id$="-settings"]')`;
const API_KEY_FIELD = `ai-${MOCK_PROVIDER_ID}-apiKey`;
const MOCK_API_KEY = 'mock-key';

const settingsTab = (index: number) =>
    `document.querySelectorAll('.settings-page__tabs .ant-tabs-tab')[${index}]`;
const ASSISTANT_TAB_INDEX = 4;

const READ_TAB_BAR = `(() => {
    const nav = document.querySelector('.settings-page__tabs > .ant-tabs-nav').getBoundingClientRect();
    const content = document.querySelector('.settings__option__content');
    const tabs = [...document.querySelectorAll('.settings-page__tabs .ant-tabs-tab')].map((tab) => {
        const box = tab.getBoundingClientRect();
        return {
            label: tab.innerText.trim(),
            inside: box.left >= nav.left - 0.5 && box.right <= nav.right + 0.5 && box.bottom <= nav.bottom + 0.5,
        };
    });
    return { tabs, sideways: content.scrollWidth - content.clientWidth };
})()`;

async function settingsShown(ctx: CaseContext, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const visible = `(${settingsTab(0)}?.getBoundingClientRect().width ?? 0) > 0`;
        if (await ctx.page.evaluate<boolean>(visible)) return true;
        if (Date.now() >= deadline) return false;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

async function openSettingsTab(ctx: CaseContext, index: number): Promise<void> {
    if (!(await settingsShown(ctx, 0))) {
        await ctx.page.clickElement(SETTINGS_MENU, 'the settings menu item');
        if (!(await settingsShown(ctx, 5000))) throw new Error('The settings page did not open');
    }
    await ctx.page.clickElement(settingsTab(index), `settings tab ${index}`);
    await ctx.page.evaluate(`new Promise((resolve) => setTimeout(resolve, 400))`);
}

async function backToChat(ctx: CaseContext): Promise<void> {
    await ctx.page.resetViewport();
    await ctx.page.open();
}

const readSavedApiKey = (ctx: CaseContext) =>
    ctx.page.evaluate<string | undefined>(
        `window.api.ai.getSettings().then((s) => s.customProviders.find((p) => p.id === ${JSON.stringify(MOCK_PROVIDER_ID)})?.apiKey)`,
    );

const readApiKeyField = (ctx: CaseContext) =>
    ctx.page.evaluate<string>(`document.getElementById(${JSON.stringify(API_KEY_FIELD)}).value`);

async function restoreApiKey(ctx: CaseContext): Promise<void> {
    await ctx.page.evaluate(
        `window.api.ai.getSettings().then((s) => window.api.ai.updateSettings({ customProviders: s.customProviders.map((p) => p.id === ${JSON.stringify(MOCK_PROVIDER_ID)} ? { ...p, apiKey: ${JSON.stringify(MOCK_API_KEY)} } : p) }))`,
    );
}

async function typeAtEndOfApiKey(ctx: CaseContext, text: string): Promise<void> {
    await ctx.page.clickElement(
        `document.getElementById(${JSON.stringify(API_KEY_FIELD)})`,
        'the API key field',
    );
    await ctx.page.evaluate(
        `(() => { const el = document.getElementById(${JSON.stringify(API_KEY_FIELD)}); el.setSelectionRange(el.value.length, el.value.length); })()`,
    );
    await ctx.page.insertText(text);
}

const settingsTabs: E2eCase = {
    name: 'settings-tabs',
    description: 'Every settings tab stays fully visible, with no sideways scroll, wide and narrow',
    async run(ctx) {
        try {
            for (const [width, height] of [
                [1440, 900],
                [760, 560],
            ]) {
                await ctx.page.setViewport(width, height);
                await openSettingsTab(ctx, ASSISTANT_TAB_INDEX);
                const bar = await ctx.page.evaluate<{
                    tabs: { label: string; inside: boolean }[];
                    sideways: number;
                }>(READ_TAB_BAR);
                ctx.check(
                    `all ${bar.tabs.length} tabs are fully visible at ${width}px with Assistant open`,
                    bar.tabs.length === 7 && bar.tabs.every((tab) => tab.inside),
                    bar.tabs,
                );
                ctx.check(
                    `the settings page has no sideways scroll at ${width}px`,
                    bar.sideways <= 0,
                    bar.sideways,
                );
                await ctx.shot(`assistant-${width}`);
            }
        } finally {
            await backToChat(ctx);
        }
    },
};

const settingsTyping: E2eCase = {
    name: 'settings-typing',
    description:
        'A settings field keeps what is typed while it saves, and a reload right after typing keeps it',
    async run(ctx) {
        try {
            await openSettingsTab(ctx, ASSISTANT_TAB_INDEX);
            await typeAtEndOfApiKey(ctx, ' ');
            await ctx.page.evaluate(`new Promise((resolve) => setTimeout(resolve, 1200))`);
            ctx.check(
                'the typed trailing space stays in the field after the save (R5)',
                (await readApiKeyField(ctx)) === `${MOCK_API_KEY} `,
                await readApiKeyField(ctx),
            );
            ctx.check(
                'the saved key is trimmed',
                (await readSavedApiKey(ctx)) === MOCK_API_KEY,
                await readSavedApiKey(ctx),
            );
            await typeAtEndOfApiKey(ctx, 'reload');
            await ctx.page.reload();
            const saved = await ctx.page.evaluate<string | undefined>(
                `new Promise((resolve) => setTimeout(resolve, 500)).then(() => window.api.ai.getSettings()).then((s) => s.customProviders.find((p) => p.id === ${JSON.stringify(MOCK_PROVIDER_ID)})?.apiKey)`,
            );
            ctx.check(
                'a value typed right before a reload is saved',
                saved === `${MOCK_API_KEY} reload`,
                saved,
            );
        } finally {
            await restoreApiKey(ctx);
            await backToChat(ctx);
        }
    },
};

export const uiReviewCases: E2eCase[] = [settingsTabs, settingsTyping];
