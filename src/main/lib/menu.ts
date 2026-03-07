import { Menu, shell, app, type BrowserWindow } from 'electron';
import { is } from '@electron-toolkit/utils';
import { PushChannels } from '@shared/ipc.types';
import { sendToRenderer } from '@main/ipc/register';

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
        return [
            {
                label: '&Fichier',
                submenu: [
                    {
                        label: 'Documents',
                        accelerator: this.isD('Ctrl+N'),
                        click: () => {
                            sendToRenderer(this.mainWindow, PushChannels.openModalDocumentFromMain);
                        },
                    },
                    {
                        label: '&Fermer',
                        accelerator: process.platform === 'darwin' ? 'Command+Q' : 'Ctrl+W',
                        click: () => {
                            app.quit();
                        },
                    },
                ],
            },
            {
                label: 'Éditer',
                submenu: [
                    {
                        label: 'Défaire',
                        accelerator: this.isD('Ctrl+Z'),
                        role: 'undo',
                    },
                    {
                        label: 'Refaire',
                        accelerator: this.isD('Ctrl+Y'),
                        role: 'redo',
                    },
                    { type: 'separator' },
                    {
                        label: 'Couper',
                        accelerator: this.isD('Ctrl+X'),
                        role: 'cut',
                    },
                    {
                        label: 'Copier',
                        accelerator: this.isD('Ctrl+C'),
                        role: 'copy',
                    },
                    {
                        label: 'Coller',
                        accelerator: this.isD('Ctrl+V'),
                        role: 'paste',
                    },
                    { type: 'separator' },
                    {
                        label: 'Tout sélectionner',
                        accelerator: this.isD('Ctrl+A'),
                        role: 'selectAll',
                    },
                ],
            },
            {
                label: '&Vue',
                submenu: [
                    {
                        label: 'Basculer la barre latérale',
                        accelerator: this.isD('Ctrl+B'),
                        click: () => {
                            sendToRenderer(this.mainWindow, PushChannels.toggleSidebar);
                        },
                    },
                    {
                        label: 'Changer de menu',
                        accelerator: 'Ctrl+Tab',
                        click: () => {
                            sendToRenderer(this.mainWindow, PushChannels.switchOnMenu);
                        },
                    },
                    {
                        label: "Changer d'option",
                        accelerator: 'Ctrl+Shift+Tab',
                        click: () => {
                            sendToRenderer(this.mainWindow, PushChannels.switchOnOptions);
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
                                  label: 'Basculer en plein écran',
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
                label: 'Outils',
                submenu: [
                    {
                        label: 'Langues',
                        accelerator: this.isD('Ctrl+L'),
                        click: () => {
                            sendToRenderer(this.mainWindow, PushChannels.openLanguageManager);
                        },
                    },
                    { type: 'separator' },
                    {
                        label: 'Sauvegarde',
                        accelerator: this.isD('Ctrl+Shift+R'),
                        click: () => {
                            sendToRenderer(this.mainWindow, PushChannels.openBackupModalFromMain);
                        },
                    },
                    {
                        label: 'Mise à jour',
                        accelerator: this.isD('Ctrl+U'),
                        click: () => {
                            sendToRenderer(this.mainWindow, PushChannels.appUpdateMenu);
                        },
                    },
                ],
            },
            {
                label: 'Aide',
                submenu: [
                    {
                        label: 'Documentation',
                        click: () => {
                            const url = process.env['DOCS_LINK'];
                            if (url) {
                                shell.openExternal(url);
                            }
                        },
                    },
                    {
                        label: 'À propos',
                        click: () => {
                            // About dialog will be ported in a later phase
                        },
                    },
                ],
            },
        ];
    }
}
