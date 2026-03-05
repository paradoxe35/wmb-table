import { DocumentChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as documentsRepo from '@main/database/repositories/documents.repository';
import * as tabsRepo from '@main/database/repositories/tabs.repository';

export function registerDocumentsHandlers(): void {
    registerHandler(DocumentChannels.getTitles, async () => {
        return documentsRepo.getAllTitles();
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
