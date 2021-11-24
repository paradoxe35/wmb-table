import { Menu, BrowserWindow, shell, app } from 'electron';
import showAboutDialog from '@main/dialogs/handlers/about';
import { IPC_EVENTS } from '@root/utils/ipc-events';

export default class MenuBuilder {
  mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  isD(accelerator: string) {
    if (process.platform === 'darwin') {
      accelerator = accelerator.replace('Ctrl', 'Command');
      accelerator = accelerator.replace('Alt', 'Ctrl');
    }
    return accelerator;
  }

  buildMenu(): Menu {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    ) {
      this.setupDevelopmentEnvironment();
    }

    const template = this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    return menu;
  }

  setupDevelopmentEnvironment(): void {
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

  buildDefaultTemplate() {
    const templateDefault = [
      {
        label: '&Fichier',
        submenu: [
          {
            label: 'Documents',
            accelerator: this.isD('Ctrl+N'),
            click: () => {
              this.mainWindow.webContents.send(
                IPC_EVENTS.open_modal_document_from_main
              );
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
      ({
        label: 'Éditer',
        submenu: [
          { label: 'Défaire', accelerator: this.isD('Ctrl+Z'), role: 'undo' },
          { label: 'Refaire', accelerator: this.isD('Ctrl+Y'), role: 'redo' },
          { type: 'separator' },
          { label: 'Couper', accelerator: this.isD('Ctrl+X'), role: 'cut' },
          { label: 'Copier', accelerator: this.isD('Ctrl+C'), role: 'copy' },
          { label: 'Coller', accelerator: this.isD('Ctrl+V'), role: 'paste' },
          { type: 'separator' },
          {
            label: 'Tout sélectionner',
            accelerator: this.isD('Ctrl+A'),
            role: 'selectAll',
          },
        ],
      } as unknown) as Electron.MenuItem,
      {
        label: '&Vue',
        submenu: [
          {
            label: 'Basculer la barre latérale',
            accelerator: this.isD('Ctrl+B'),
            click: () => {
              this.mainWindow.webContents.send(IPC_EVENTS.toggle_sidebar);
            },
          },
          {
            label: 'Changer de menu',
            accelerator: 'Ctrl+Tab',
            click: () => {
              this.mainWindow.webContents.send(IPC_EVENTS.switch_on_menu);
            },
          },
          {
            label: "Changer d'option",
            accelerator: 'Ctrl+Shift+Tab',
            click: () => {
              this.mainWindow.webContents.send(IPC_EVENTS.switch_on_options);
            },
          },
          ...(process.env.NODE_ENV === 'development' ||
          process.env.DEBUG_PROD === 'true'
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
                      !this.mainWindow.isFullScreen()
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
                      !this.mainWindow.isFullScreen()
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
            label: 'Sauvegarde',
            accelerator: this.isD('Ctrl+Shift+R'),
            click: () => {
              this.mainWindow.webContents.send(
                IPC_EVENTS.open_backup_modal_from_main
              );
            },
          },
          {
            label: 'Mis à jour',
            accelerator: this.isD('Ctrl+U'),
            click: () => {
              this.mainWindow.webContents.send(IPC_EVENTS.app_update_menu);
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
              const url = process.env.DOCS_LINK;
              if (url) {
                shell.openExternal(url);
              }
            },
          },
          {
            label: 'À propos',
            click: () => {
              showAboutDialog(this.mainWindow);
            },
          },
        ],
      },
    ];

    return templateDefault;
  }
}
