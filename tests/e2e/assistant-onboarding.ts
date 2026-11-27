import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MOCK_PROVIDER_ID } from './driver/app-setup';
import type { CdpSession } from './driver/cdp';
import type { ChatPage } from './driver/chat-page';
import type { SettingsPage } from './driver/settings-page';
import { MOCK_MODEL_ID } from './mock-llm/scenario';

export interface OnboardingContext {
    cdp: CdpSession;
    settings: SettingsPage;
    chat: ChatPage;
    appDataDir: string;
    mockBaseUrl: string;
    check(label: string, passed: boolean, details?: unknown, knownBug?: string): void;
    shot(name: string): Promise<string[]>;
    reload(): Promise<void>;
    setUiLanguage(language: string): Promise<void>;
}

const SETUP_CARD = '[data-testid="ai-setup-card"]';
const CHAT_INPUT = 'textarea.ai-chat__input-textarea';
const ASSISTANT_MENU = '[data-menu-id$="ai-chat"]';
const SMALL_WINDOW = { width: 700, height: 560, deviceScaleFactor: 1, mobile: false };
const DESKTOP_WINDOW = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false };
const ECHO_REPLY = 'MOCK-ECHO-DONE';

const visible = (selector: string) =>
    `Boolean([...document.querySelectorAll(${JSON.stringify(selector)})].some((el) => el.getBoundingClientRect().width > 0))`;

/** Takes the assistant from a fresh profile to a working chat, the way a new user would. */
export class AssistantOnboarding {
    private readonly ctx: OnboardingContext;

    constructor(ctx: OnboardingContext) {
        this.ctx = ctx;
    }

    async run(): Promise<void> {
        await this.resetToFreshSettings();
        await this.welcomeCard();
        await this.welcomeCardLanguages();
        await this.welcomeCardSmallWindow();
        await this.configureFromCard();
        await this.chatWorks('the configured assistant answers a message');
        await this.oldProfileTurnedOff();
    }

    /** Removing the row makes main create the default settings again, as on a first launch. */
    private async resetToFreshSettings(): Promise<void> {
        const db = new DatabaseSync(join(this.ctx.appDataDir, 'databases', 'wmb-table.sqlite'));
        try {
            db.prepare("DELETE FROM ai_settings WHERE id = 'ai_settings'").run();
        } finally {
            db.close();
        }
        await this.ctx.reload();
    }

    /** Moves the pointer off the menu afterwards so its tooltip stays out of the screenshots. */
    private async openAssistant(): Promise<void> {
        await this.ctx.settings.click(ASSISTANT_MENU);
        await this.ctx.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 400, y: 40 });
        await this.ctx.cdp.waitFor(
            `${visible(SETUP_CARD)} || ${visible(CHAT_INPUT)}`,
            'assistant page',
        );
    }

    private async welcomeCard(): Promise<void> {
        console.log('Onboarding: welcome card on a fresh profile');
        const settings = await this.ctx.cdp.evaluate<{ activeProvider: string | null }>(
            'window.api.ai.getSettings()',
        );
        this.ctx.check(
            'a fresh profile has no provider',
            settings.activeProvider === null,
            settings,
        );
        const menu = await this.ctx.settings.text(ASSISTANT_MENU);
        this.ctx.check(
            'the sidebar shows the assistant on a fresh profile',
            menu.some((label) => label.includes('Assistant')),
            menu,
        );
        await this.openAssistant();
        this.ctx.check(
            'the chat shows the welcome card',
            await this.ctx.cdp.evaluate(visible(SETUP_CARD)),
        );
        this.ctx.check(
            'the chat input is not shown before setup',
            !(await this.ctx.cdp.evaluate(visible(CHAT_INPUT))),
        );
        const text = (await this.ctx.settings.text(SETUP_CARD)).join(' ');
        this.ctx.check(
            'the card has the title, both texts and both actions',
            [
                'Assistant IA',
                "sujet d'étude",
                'Ollama sur votre ordinateur',
                "Configurer l'assistant",
                'Voir le guide',
            ].every((part) => text.includes(part)),
            text,
        );
        await this.ctx.shot('welcome-card');
    }

    private async welcomeCardLanguages(): Promise<void> {
        const expectedButton: Record<string, string> = {
            en: 'Set up the assistant',
            es: 'Configurar el asistente',
            pt: 'Configurar o assistente',
            sw: 'Sanidi msaidizi',
        };
        for (const [language, button] of Object.entries(expectedButton)) {
            await this.ctx.setUiLanguage(language);
            await this.ctx.reload();
            await this.openAssistant();
            const text = (await this.ctx.settings.text(SETUP_CARD)).join(' ');
            this.ctx.check(
                `the welcome card is translated in ${language}`,
                text.includes(button),
                text,
            );
            await this.ctx.shot(`welcome-card-${language}`);
        }
        await this.ctx.setUiLanguage('fr');
        await this.ctx.reload();
    }

    private async welcomeCardSmallWindow(): Promise<void> {
        await this.ctx.cdp.send('Emulation.setDeviceMetricsOverride', SMALL_WINDOW);
        await this.openAssistant();
        const fits = await this.ctx.cdp.evaluate<{ fits: boolean; box: unknown }>(`(() => {
            const button = [...document.querySelectorAll('${SETUP_CARD} button')].find((b) => b.innerText.includes('Configurer'));
            const box = button.getBoundingClientRect();
            return { fits: box.right <= window.innerWidth && box.width > 0, box: box.toJSON() };
        })()`);
        this.ctx.check('the card fits a small window', fits.fits, fits);
        await this.ctx.shot('welcome-card-small-window');
        await this.ctx.cdp.send('Emulation.setDeviceMetricsOverride', DESKTOP_WINDOW);
    }

    private async configureFromCard(): Promise<void> {
        console.log('Onboarding: set up from the card');
        await this.openAssistant();
        await this.ctx.settings.clickText(`${SETUP_CARD} button`, "Configurer l'assistant");
        await this.ctx.cdp.waitFor(
            `!document.querySelector('.settings__option__content').classList.contains('view-panel--hidden')`,
            'settings page',
        );
        const onAssistantTab = await this.ctx.cdp
            .waitFor(
                `Boolean(document.querySelector('.settings-page__tabs [data-node-key="ai"].ant-tabs-tab-active'))`,
                'assistant tab',
                5_000,
            )
            .then(
                () => true,
                () => false,
            );
        this.ctx.check('the button opens Settings on the Assistant tab', onAssistantTab);
        this.ctx.check(
            'the Assistant tab has no on/off switch',
            !(await this.ctx.cdp.evaluate(
                `Boolean(document.querySelector('#ai-enabled, .settings-page .ant-switch'))`,
            )),
        );
        await this.ctx.shot('settings-tab-fresh');

        const s = this.ctx.settings;
        await s.openAddProvider();
        await this.ctx.cdp.waitFor(
            `Boolean(document.querySelector('#ai-custom-provider-name'))`,
            'add provider modal',
        );
        await s.paste('#ai-custom-provider-name', 'Mock LLM');
        await s.paste('#ai-custom-provider-base-url', this.ctx.mockBaseUrl);
        await s.paste('#ai-custom-provider-api-key', 'mock-key');
        await s.paste('#ai-custom-provider-model', MOCK_MODEL_ID);
        await s.click('.ant-modal-footer .ant-btn-primary');
        await this.ctx.cdp.waitFor(
            `Boolean(document.querySelector('#ai-${MOCK_PROVIDER_ID}-apiKey'))`,
            'mock provider card',
        );
        await this.ctx.cdp.evaluate(
            `window.api.ai.fetchProviderModels({ providerId: ${JSON.stringify(MOCK_PROVIDER_ID)} })`,
        );
        await this.ctx.shot('settings-tab-configured');

        await this.openAssistant();
        this.ctx.check(
            'back in the chat, the normal chat shows without a restart',
            await this.ctx.cdp.evaluate(visible(CHAT_INPUT)),
        );
        this.ctx.check(
            'the welcome card is gone',
            !(await this.ctx.cdp.evaluate(visible(SETUP_CARD))),
        );
    }

    private async chatWorks(label: string): Promise<void> {
        await this.ctx.chat.send(`Bonjour, l'amour de Dieu ? #scenario:echo`);
        const facts = await this.ctx.chat
            .waitForFacts(
                (f) =>
                    f.messages.some((m) => m.role === 'assistant' && m.text.includes(ECHO_REPLY)) ||
                    f.errorAlerts.length > 0,
                'an answer or an error',
                30_000,
            )
            .catch((error: unknown) => ({ messages: [], errorAlerts: [String(error)] }));
        this.ctx.check(
            label,
            facts.messages.some((m) => m.role === 'assistant' && m.text.includes(ECHO_REPLY)),
            facts.errorAlerts,
        );
    }

    private async oldProfileTurnedOff(): Promise<void> {
        console.log('Onboarding: an old profile with the assistant turned off');
        await this.ctx.cdp.evaluate('window.api.ai.updateSettings({ enabled: false })');
        await this.ctx.reload();
        await this.openAssistant();
        this.ctx.check(
            'an old profile with enabled: false shows the chat',
            await this.ctx.cdp.evaluate(visible(CHAT_INPUT)),
        );
        await this.ctx.chat.startNewConversation();
        await this.chatWorks('an old profile with enabled: false can chat');
        await this.ctx.shot('old-profile-chat');
        await this.ctx.cdp.evaluate('window.api.ai.updateSettings({ enabled: true })');
    }
}
