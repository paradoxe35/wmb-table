import { Menu, shell, app, dialog, type BrowserWindow } from 'electron';
import { is } from '@electron-toolkit/utils';
import { PushChannels } from '@shared/ipc.types';
import {
    APP_AUTHOR,
    APP_AUTHOR_EMAIL,
    APP_LICENSE,
    DOCS_CONTACT_LINK,
    DOCS_LINK,
    WEBSITE_LINK,
} from '@shared/constants';
import { sendToRenderer } from '@main/ipc/ipc-bridge';
import i18n from '@main/lib/i18n';

/**
 * Deliberately absent from the menu: the shipped build keeps devtools reachable for whoever
 * maintains it, without advertising them. `code` rather than `key` so the physical position
 * holds on non-QWERTY layouts.
 */
export function isDevToolsShortcut(input: Electron.Input): boolean {
    if (input.type !== 'keyDown' || input.code !== 'KeyI' || !input.shift || input.alt) {
        return false;
    }
    return process.platform === 'darwin' ? input.meta || input.control : input.control;
}

export default class MenuBuilder {
    private mainWindow: BrowserWindow;

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
    }

    private isD(accelerator: string): string {
        if (process.platform === 'darwin') {
            accelerator = accelerator.replace('Ctrl', 'Command');
            accelerator = accelerator.replace('Alt', 'Ctrl');
        }
        return accelerator;
    }

    buildMenu(): Menu {
        if (is.dev) {
            this.setupDevelopmentEnvironment();
        }

        this.mainWindow.webContents.on('before-input-event', (event, input) => {
            if (
                input.key === 'Escape' &&
                input.type === 'keyDown' &&
                this.mainWindow.isFullScreen()
            ) {
                this.mainWindow.setFullScreen(false);
                return;
            }

            if (isDevToolsShortcut(input)) {
                event.preventDefault();
                this.mainWindow.webContents.toggleDevTools();
            }
        });

        const template = this.buildDefaultTemplate();
        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
        return menu;
    }

    private setupDevelopmentEnvironment(): void {
        this.mainWindow.webContents.on('context-menu', (_, props) => {
            const { x, y } = props;
            Menu.buildFromTemplate([
                {
                    label: 'Inspect element',
                    click: () => {
                        this.mainWindow.webContents.inspectElement(x, y);
                    },
                },
            ]).popup({ window: this.mainWindow });
        });
    }

    private buildDefaultTemplate(): Electron.MenuItemConstructorOptions[] {
        const t = i18n.t.bind(i18n);
        return [
            {
                label: t('&Fichier'),
                submenu: [
                    {
                        label: t('Documents'),
                        accelerator: this.isD('Ctrl+N'),
                        click: () => {
                            sendToRenderer(this.mainWindow, PushChannels.openModalDocumentFromMain);
                        },
                    },
                    {
                        label: t('&Fermer'),
                        accelerator: process.platform === 'darwin' ? 'Command+Q' : 'Ctrl+Q',
                        click: () => {
                            app.quit();
                        },
                    },
                ],
            },
            {
                label: t('Éditer'),
                submenu: [
                    {
                        label: t('Défaire'),
                        accelerator: this.isD('Ctrl+Z'),
                        role: 'undo',
                    },
                    {
                        label: t('Refaire'),
                        accelerator: this.isD('Ctrl+Y'),
                        role: 'redo',
                    },
                    { type: 'separator' },
                    {
                        label: t('Couper'),
                        accelerator: this.isD('Ctrl+X'),
                        role: 'cut',
                    },
                    {
                        label: t('Copier'),
                        accelerator: this.isD('Ctrl+C'),
                        role: 'copy',
                    },
                    {
                        label: t('Coller'),
                        accelerator: this.isD('Ctrl+V'),
                        role: 'paste',
                    },
                    { type: 'separator' },
                    {
                        label: t('Tout sélectionner'),
                        accelerator: this.isD('Ctrl+A'),
                        role: 'selectAll',
                    },
                ],
            },
            {
                label: t('&Vue'),
                submenu: [
                    {
                        label: t('Basculer la barre latérale'),
                        accelerator: this.isD('Ctrl+B'),
                        click: () => {
                            sendToRenderer(this.mainWindow, PushChannels.toggleSidebar);
                        },
                    },
                    {
                        label: t('Changer de menu'),
                        accelerator: 'Ctrl+Tab',
                        click: () => {
                            sendToRenderer(this.mainWindow, PushChannels.switchOnMenu);
                        },
                    },
                    {
                        label: t("Changer d'option"),
                        accelerator: 'Ctrl+Shift+Tab',
                        click: () => {
                            sendToRenderer(this.mainWindow, PushChannels.switchOnOptions);
                        },
                    },
                    { type: 'separator' },
                    {
                        label: t('Paramètres'),
                        accelerator: this.isD('Ctrl+,'),
                        click: () => {
                            sendToRenderer(this.mainWindow, PushChannels.openSettings);
                        },
                    },
                    {
                        label: t('Bibliothèque'),
                        accelerator: this.isD('Ctrl+L'),
                        click: () => {
                            sendToRenderer(this.mainWindow, PushChannels.openLibrary);
                        },
                    },
                    { type: 'separator' },
                    {
                        label: t('Mode lecture'),
                        accelerator: this.isD('Ctrl+Shift+R'),
                        click: () => {
                            sendToRenderer(this.mainWindow, PushChannels.toggleReadingMode);
                        },
                    },
                    ...(is.dev
                        ? [
                              {
                                  label: '&Reload',
                                  accelerator: this.isD('Ctrl+R'),
                                  click: () => {
                                      this.mainWindow.webContents.reload();
                                  },
                              },
                              {
                                  label: 'Toggle &Full Screen',
                                  accelerator: 'F11',
                                  click: () => {
                                      this.mainWindow.setFullScreen(
                                          !this.mainWindow.isFullScreen(),
                                      );
                                  },
                              },
                              {
                                  label: 'Toggle &Developer Tools',
                                  accelerator: this.isD('Alt+Ctrl+I'),
                                  click: () => {
                                      this.mainWindow.webContents.toggleDevTools();
                                  },
                              },
                          ]
                        : [
                              {
                                  label: t('Basculer en plein écran'),
                                  accelerator: 'F11',
                                  click: () => {
                                      this.mainWindow.setFullScreen(
                                          !this.mainWindow.isFullScreen(),
                                      );
                                  },
                              },
                          ]),
                ],
            },
            {
                label: t('Aide'),
                submenu: [
                    {
                        label: t('Documentation'),
                        click: () => {
                            shell.openExternal(DOCS_LINK);
                        },
                    },
                    {
                        label: t('Nous contacter'),
                        click: () => {
                            shell.openExternal(DOCS_CONTACT_LINK);
                        },
                    },
                    { type: 'separator' },
                    {
                        label: t('À propos'),
                        click: () => {
                            dialog.showMessageBox(this.mainWindow, {
                                title: t('À propos'),
                                type: 'info',
                                message: [
                                    `${t('Produit')}: ${app.getName()}`,
                                    `${t('Version')}: ${app.getVersion()}`,
                                    `${t('Site web')}: ${WEBSITE_LINK}`,
                                    '',
                                    `${t('Auteur')}: ${APP_AUTHOR}`,
                                    `Email: ${APP_AUTHOR_EMAIL}`,
                                    `${t('Licence')}: ${APP_LICENSE}`,
                                ].join('\n'),
                                buttons: ['Ok'],
                                cancelId: 0,
                            });
                        },
                    },
                ],
            },
        ];
    }
}
