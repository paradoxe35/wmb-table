import { SubjectChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as subjectsRepo from '@main/database/repositories/subjects.repository';

export function registerSubjectsHandlers(): void {
    registerHandler(SubjectChannels.getAll, async () => {
        return subjectsRepo.getAll();
    });

    registerHandler(SubjectChannels.create, async (_event, name) => {
        return subjectsRepo.create(name);
    });

    registerHandler(SubjectChannels.rename, async (_event, id, newName) => {
        subjectsRepo.rename(id, newName);
    });

    registerHandler(SubjectChannels.delete, async (_event, id) => {
        subjectsRepo.deleteSubject(id);
    });

    registerHandler(SubjectChannels.getItems, async (_event, subjectName) => {
        return subjectsRepo.getItems(subjectName);
    });

    registerHandler(SubjectChannels.deleteItem, async (_event, id) => {
        subjectsRepo.deleteItem(id);
    });

    registerHandler(
        SubjectChannels.createItem,
        async (
            _event,
            subjectName,
            documentTitle,
            documentHtmlTree,
            textContent,
            bible,
            sermonId,
        ) => {
            return subjectsRepo.createItem(
                subjectName,
                documentTitle,
                documentHtmlTree,
                textContent,
                bible,
                sermonId,
            );
        },
    );
}
