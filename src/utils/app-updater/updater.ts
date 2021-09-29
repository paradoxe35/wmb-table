import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify({
      title: "Mise à jour de l'application",
      body:
        "Une nouvelle version a été téléchargée. Redémarrez l'application pour appliquer les mises à jour.",
    });
  }
}
