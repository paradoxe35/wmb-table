import { SubjectChannels } from '@shared/ipc.types';
import { registerHandler } from './ipc-bridge';
import * as subjectsRepo from '@main/database/repositories/subjects.repository';
import { exportHtmlToPdf } from '@main/lib/pdf-export';
import { buildSubjectExportHtml } from '@main/lib/subjects-export';

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

    registerHandler(SubjectChannels.getItems, async (_event, subjectId) => {
        return subjectsRepo.getItems(subjectId);
    });

    registerHandler(SubjectChannels.reorderItems, async (_event, subjectId, itemIds) => {
        subjectsRepo.reorderItems(subjectId, itemIds);
    });

    registerHandler(SubjectChannels.deleteItem, async (_event, id) => {
        subjectsRepo.deleteItem(id);
    });

    registerHandler(
        SubjectChannels.createItem,
        async (
            _event,
            subjectId,
            documentTitle,
            documentReference,
            textContent,
            documentPreview,
        ) => {
            return subjectsRepo.createItem(
                subjectId,
                documentTitle,
                documentReference,
                textContent,
                documentPreview,
            );
        },
    );

    registerHandler(SubjectChannels.exportPdf, async (_event, subjectId) => {
        const subject = subjectsRepo.getById(subjectId);
        if (!subject) {
            throw new Error('Sujet introuvable');
        }
        if (subject.documents.length === 0) {
            return { status: 'empty' } as const;
        }

        const html = buildSubjectExportHtml(subject.name, subject.documents);
        return exportHtmlToPdf({ html, defaultName: subject.name, directory: 'subjects' });
    });
}
