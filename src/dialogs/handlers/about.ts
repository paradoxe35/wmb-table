import { BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

export default function showAboutDialog(mainWindow: BrowserWindow) {
  dialog.showMessageBoxSync(mainWindow, {
    title: 'À propos',
    type: 'info',
    message: `
        Produit: Wmb Table
        Language: Français
        Version: ${autoUpdater.currentVersion.version}
        Website: https://wmb-table.web.app
        ----- ------ -----
        Auteur: Paradoxe Ngwasi
        Email: paradoxngwasi@gmail.com
        Website: https://png-me.web.app
        Licence: GNU GPLv3
    `,
    buttons: ['Ok'],
    cancelId: 0,
  });
}
