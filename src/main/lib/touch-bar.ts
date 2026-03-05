import { TouchBar, nativeImage, type BrowserWindow, ipcMain } from 'electron';
import { PushChannels } from '@shared/ipc.types';
import { sendToRenderer } from '@main/ipc/register';
import type { ViewMenuValue } from '@shared/types';
import { join } from 'node:path';

const { TouchBarButton, TouchBarSpacer, TouchBarLabel } = TouchBar;

const BG_COLOR = '#1a9aef';

export function createTouchBar(mainWindow: BrowserWindow): TouchBar {
    const documentViewedTitle = new TouchBarLabel({ label: '' });

    const optionViewerMenu = new TouchBarButton({
        icon: nativeImage
            .createFromPath(join(__dirname, '../../resources/img/ProfileOutlined.png'))
            .resize({ width: 16, height: 16 }),
        click() {
            sendToRenderer(mainWindow, PushChannels.changeMenuViewer, 'options' as ViewMenuValue);
        },
    });

    const documentViewerMenu = new TouchBarButton({
        icon: nativeImage
            .createFromPath(join(__dirname, '../../resources/img/FundViewOutlined.png'))
            .resize({ width: 16, height: 16 }),
        click() {
            sendToRenderer(mainWindow, PushChannels.changeMenuViewer, 'document' as ViewMenuValue);
        },
    });

    // Listen for active document changes from renderer
    ipcMain.on('touch-bar:activeDocument', (_event, document: string) => {
        documentViewedTitle.label = document;
    });

    // Listen for viewer menu changes from renderer
    ipcMain.on('touch-bar:menuViewerChanged', (_event, view: ViewMenuValue) => {
        if (view === 'document') {
            documentViewerMenu.backgroundColor = BG_COLOR;
            optionViewerMenu.backgroundColor = undefined as unknown as string;
        }
        if (view === 'options') {
            documentViewerMenu.backgroundColor = undefined as unknown as string;
            optionViewerMenu.backgroundColor = BG_COLOR;
        }
    });

    return new TouchBar({
        items: [
            optionViewerMenu,
            documentViewerMenu,
            new TouchBarSpacer({ size: 'large' }),
            documentViewedTitle,
        ],
    });
}
