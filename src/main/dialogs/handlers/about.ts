import { BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import { APP_NAME } from '@root/utils/constants';

export default function showAboutDialog(mainWindow: BrowserWindow) {
  dialog.showMessageBoxSync(mainWindow, {
    title: 'À propos',
    type: 'info',
    message: `
        Produit: ${APP_NAME}
        Language: Français
        Version: ${autoUpdater.currentVersion.version}
        Website: ${process.env.WEBSITE_LINK}
        Source des documents: https://branham.fr/sermons
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
