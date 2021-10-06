import log from 'electron-log';
import { autoUpdater } from 'electron-updater';

export default class AppAutoUpdater {
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
