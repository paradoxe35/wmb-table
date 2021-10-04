import {
  app,
  Menu,
  BrowserWindow,
  MenuItemConstructorOptions,
  shell,
} from 'electron';
import showAboutDialog from './dialogs/handlers/about';
import { IPC_EVENTS } from './utils/ipc-events';

interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  selector?: string;
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
}

export default class MenuBuilder {
  mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  buildMenu(): Menu {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    ) {
      this.setupDevelopmentEnvironment();
    }

    const template =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

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

  buildDarwinTemplate(): MenuItemConstructorOptions[] {
    const subMenuAbout: DarwinMenuItemConstructorOptions = {
      label: 'Electron',
      submenu: [
        {
          label: 'About ElectronReact',
          selector: 'orderFrontStandardAboutPanel:',
        },
        { type: 'separator' },
        { label: 'Services', submenu: [] },
        { type: 'separator' },
        {
          label: 'Hide ElectronReact',
          accelerator: 'Command+H',
          selector: 'hide:',
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:',
        },
        { label: 'Show All', selector: 'unhideAllApplications:' },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    };
    const subMenuEdit: DarwinMenuItemConstructorOptions = {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'Command+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+Command+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Command+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'Command+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'Command+V', selector: 'paste:' },
        {
          label: 'Select All',
          accelerator: 'Command+A',
          selector: 'selectAll:',
        },
      ],
    };
    const subMenuViewDev: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: () => {
            this.mainWindow.webContents.reload();
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            this.mainWindow.webContents.toggleDevTools();
          },
        },
      ],
    };
    const subMenuViewProd: MenuItemConstructorOptions = {
      label: 'Vue',
      submenu: [
        {
          label: 'Basculer en plein écran',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
      ],
    };
    const subMenuWindow: DarwinMenuItemConstructorOptions = {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:',
        },
        { label: 'Close', accelerator: 'Command+W', selector: 'performClose:' },
        { type: 'separator' },
        { label: 'Bring All to Front', selector: 'arrangeInFront:' },
      ],
    };

    const subMenuView =
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
        ? subMenuViewDev
        : subMenuViewProd;

    return [subMenuAbout, subMenuEdit, subMenuView, subMenuWindow];
  }

  buildDefaultTemplate() {
    const templateDefault = [
      {
        label: '&Fichier',
        submenu: [
          {
            label: 'Documents',
            accelerator: 'Ctrl+N',
            click: () => {
              this.mainWindow.webContents.send(
                IPC_EVENTS.open_modal_document_from_main
              );
            },
          },
          {
            label: '&Fermer',
            accelerator: 'Ctrl+W',
            click: () => {
              this.mainWindow.close();
            },
          },
        ],
      },
      ({
        label: 'Éditer',
        submenu: [
          { label: 'Défaire', accelerator: 'Ctrl+Z', role: 'undo' },
          { label: 'Refaire', accelerator: 'Ctrl+Y', role: 'redo' },
          { type: 'separator' },
          { label: 'Couper', accelerator: 'Ctrl+X', role: 'cut' },
          { label: 'Copier', accelerator: 'Ctrl+C', role: 'copy' },
          { label: 'Coller', accelerator: 'Ctrl+V', role: 'paste' },
          { type: 'separator' },
          {
            label: 'Tout sélectionner',
            accelerator: 'Ctrl+A',
            role: 'selectAll',
          },
        ],
      } as unknown) as Electron.MenuItem,
      {
        label: '&Vue',
        submenu: [
          {
            label: 'Basculer la barre latérale',
            accelerator: 'Ctrl+B',
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
                  accelerator: 'Ctrl+R',
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
                  accelerator: 'Alt+Ctrl+I',
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
            accelerator: 'Ctrl+Shift+R',
            click: () => {
              this.mainWindow.webContents.send(
                IPC_EVENTS.open_backup_modal_from_main
              );
            },
          },
          {
            label: 'Mis à jour',
            accelerator: 'Ctrl+U',
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
