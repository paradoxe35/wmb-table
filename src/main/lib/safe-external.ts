import { shell, type WebContents } from 'electron';
import { toSafeExternalUrl } from '@shared/external-url';
import log from '@main/lib/logger';

type ExternalUrlSource = 'window-open' | 'ipc';

function describeScheme(value: unknown): string {
    if (typeof value !== 'string') return typeof value;
    const match = /^\s*([a-z][a-z0-9+.-]*):/i.exec(value);
    return match ? `${match[1].toLowerCase()}:` : 'no scheme';
}

export async function openExternalSafely(
    value: unknown,
    source: ExternalUrlSource,
): Promise<boolean> {
    const url = toSafeExternalUrl(value);
    if (!url) {
        log.warn(`[external] Refused to open a link (${describeScheme(value)}) from ${source}`);
        return false;
    }

    await shell.openExternal(url);
    return true;
}

export function isAppPageNavigation(target: string, appPageUrl: string): boolean {
    let targetUrl: URL;
    let appUrl: URL;
    try {
        targetUrl = new URL(target);
        appUrl = new URL(appPageUrl);
    } catch {
        return false;
    }

    if (appUrl.protocol === 'file:') {
        return (
            targetUrl.protocol === 'file:' &&
            targetUrl.host === appUrl.host &&
            targetUrl.pathname === appUrl.pathname
        );
    }
    return targetUrl.origin === appUrl.origin;
}

export function secureWindowNavigation(webContents: WebContents, appPageUrl: string): void {
    webContents.setWindowOpenHandler(({ url }) => {
        openExternalSafely(url, 'window-open').catch((error: unknown) => {
            log.warn('[external] The OS could not open a link:', error);
        });
        return { action: 'deny' };
    });

    webContents.on('will-navigate', (event, target) => {
        if (isAppPageNavigation(target, appPageUrl)) return;

        event.preventDefault();
        log.warn(`[external] Blocked navigation of the app window (${describeScheme(target)})`);
    });
}
