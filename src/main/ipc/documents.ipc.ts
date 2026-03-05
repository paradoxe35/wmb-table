import { DocumentChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as sermonMetadataRepo from '@main/database/repositories/sermon-metadata.repository';
import * as tabsRepo from '@main/database/repositories/tabs.repository';

export function registerDocumentsHandlers(): void {
    registerHandler(DocumentChannels.getTitles, async () => {
        return sermonMetadataRepo.getSermonList('en'); // TODO: use active language from config
    });

    registerHandler(DocumentChannels.getContentPath, async () => {
        throw new Error('Not implemented: documents:getContentPath');
    });

    registerHandler(DocumentChannels.getTabs, async () => {
        return tabsRepo.getTabs();
    });

    registerHandler(DocumentChannels.saveTabs, async (_event, datas) => {
        tabsRepo.saveTabs(datas);
    });
}
