import type { CaseContext, E2eCase } from './case-runner';
import { MOCK_PROVIDER_ID } from './driver/app-setup';

const SETTINGS_MENU = `document.querySelector('[data-menu-id$="-settings"]')`;
const API_KEY_FIELD = `ai-${MOCK_PROVIDER_ID}-apiKey`;
const MOCK_API_KEY = 'mock-key';

const settingsTab = (index: number) =>
    `document.querySelectorAll('.settings-page__tabs .ant-tabs-tab')[${index}]`;
const ASSISTANT_TAB_INDEX = 4;

const TAB_FULLY_SHOWN = `(tab) => {
    const wrap = document.querySelector('.settings-page__tabs > .ant-tabs-nav .ant-tabs-nav-wrap').getBoundingClientRect();
    const box = tab.getBoundingClientRect();
    return box.width > 0 && box.left >= wrap.left - 0.5 && box.right <= wrap.right + 0.5;
}`;
const MORE_BUTTON = `document.querySelector('.settings-page__tabs > .ant-tabs-nav .ant-tabs-nav-more')`;
const OPEN_MORE_ITEMS = `[...document.querySelectorAll('.ant-tabs-dropdown:not(.ant-tabs-dropdown-hidden) .ant-tabs-dropdown-menu-item')]`;

const READ_TAB_BAR = `(() => {
    const shown = ${TAB_FULLY_SHOWN};
    const more = ${MORE_BUTTON};
    const tabs = [...document.querySelectorAll('.settings-page__tabs .ant-tabs-tab')].map((tab) => ({
        label: tab.innerText.trim(),
        shown: shown(tab),
        active: tab.classList.contains('ant-tabs-tab-active'),
    }));
    const content = document.querySelector('.settings__option__content');
    return {
        tabs,
        moreShown: Boolean(more) && more.getBoundingClientRect().width > 0 && getComputedStyle(more).visibility !== 'hidden',
        sideways: content.scrollWidth - content.clientWidth,
    };
})()`;

interface TabBar {
    tabs: { label: string; shown: boolean; active: boolean }[];
    moreShown: boolean;
    sideways: number;
}

const VISIBLE_MORE_ITEMS = `${OPEN_MORE_ITEMS}.filter((item) => item.getBoundingClientRect().width > 0)`;

/** The menu opens on hover and a click toggles it, so click only while it is closed. */
async function openMoreMenu(ctx: CaseContext): Promise<string[]> {
    const deadline = Date.now() + 5000;
    for (;;) {
        const labels = await ctx.page.evaluate<string[]>(
            `${VISIBLE_MORE_ITEMS}.map((item) => item.innerText.trim())`,
        );
        if (labels.length > 0) return labels;
        if (Date.now() >= deadline) throw new Error('The « … » tab menu did not open');
        await ctx.page.clickElement(MORE_BUTTON, 'the « … » tab menu');
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
}

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
    const fullyShown = await ctx.page.evaluate<boolean>(
        `(${TAB_FULLY_SHOWN})(${settingsTab(index)})`,
    );
    if (fullyShown) {
        await ctx.page.clickElement(settingsTab(index), `settings tab ${index}`);
    } else {
        const label = await ctx.page.evaluate<string>(`${settingsTab(index)}.innerText.trim()`);
        await openMoreMenu(ctx);
        await ctx.page.clickElement(
            `${VISIBLE_MORE_ITEMS}.find((item) => item.innerText.trim() === ${JSON.stringify(label)})`,
            `the "${label}" tab in the « … » menu`,
        );
    }
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

const SETTINGS_TAB_COUNT = 7;
const LAST_TAB_INDEX = SETTINGS_TAB_COUNT - 1;

const settingsTabs: E2eCase = {
    name: 'settings-tabs',
    description:
        'Settings tabs that do not fit go in the « … » menu: none is cut, all stay reachable, wide and narrow',
    async run(ctx) {
        try {
            for (const [width, height] of [
                [1440, 900],
                [760, 560],
            ]) {
                await ctx.page.setViewport(width, height);
                await openSettingsTab(ctx, ASSISTANT_TAB_INDEX);
                const bar = await ctx.page.evaluate<TabBar>(READ_TAB_BAR);
                const hidden = bar.tabs.filter((tab) => !tab.shown).map((tab) => tab.label);
                ctx.check(
                    `the Assistant tab is open and fully visible at ${width}px`,
                    bar.tabs.length === SETTINGS_TAB_COUNT &&
                        bar.tabs.some((tab) => tab.active && tab.shown),
                    bar.tabs,
                );
                ctx.check(
                    `the « … » menu shows only when tabs do not fit at ${width}px`,
                    bar.moreShown === hidden.length > 0,
                    { moreShown: bar.moreShown, hidden },
                );
                if (bar.moreShown) {
                    const items = await openMoreMenu(ctx);
                    ctx.check(
                        `every tab that does not fit is in the « … » menu at ${width}px`,
                        hidden.every((label) => items.includes(label)),
                        { hidden, items },
                    );
                    await ctx.shot(`tabs-more-menu-${width}`);
                }
                ctx.check(
                    `the settings page has no sideways scroll at ${width}px`,
                    bar.sideways <= 0,
                    bar.sideways,
                );
                await ctx.shot(`assistant-${width}`);

                await openSettingsTab(ctx, LAST_TAB_INDEX);
                const last = await ctx.page.evaluate<TabBar>(READ_TAB_BAR);
                ctx.check(
                    `the last tab opens and comes into view at ${width}px`,
                    last.tabs[LAST_TAB_INDEX].active && last.tabs[LAST_TAB_INDEX].shown,
                    last.tabs,
                );
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

const READ_NOTICE_OVERFLOW = `[...document.querySelectorAll('.ai-chat__run-notice')].flatMap((notice) => {
    const box = notice.getBoundingClientRect();
    return [...notice.querySelectorAll('button')]
        .filter((button) => button.getBoundingClientRect().right > box.right + 0.5)
        .map((button) => button.innerText.trim());
})`;

const narrowBanners: E2eCase = {
    name: 'narrow-banners',
    description: 'Banner buttons with long Swahili labels stay inside the banner in a small window',
    async run(ctx) {
        try {
            await ctx.page.setUiLanguage('sw');
            await ctx.page.setViewport(760, 560);
            for (const scenario of ['401', 'step-limit']) {
                await ctx.page.startNewConversation();
                await ctx.page.send(`Narrow ${scenario} #scenario:${scenario}`);
                await ctx.waitForRunEnd();
                await ctx.waitUntil(() => true, 'a settled banner');
                const outside = await ctx.page.evaluate<string[]>(READ_NOTICE_OVERFLOW);
                ctx.check(
                    `the ${scenario} banner buttons fit inside the banner`,
                    (await ctx.page.noticeTexts()).length > 0 && outside.length === 0,
                    outside,
                );
                await ctx.shot(`sw-760-${scenario}`);
            }
        } finally {
            await ctx.page.resetViewport();
            await ctx.page.setUiLanguage('fr');
        }
    },
};

export const uiReviewCases: E2eCase[] = [settingsTabs, settingsTyping, narrowBanners];
