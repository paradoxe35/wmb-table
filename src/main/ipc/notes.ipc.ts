import { NotesChannels } from '@shared/ipc.types';
import { registerHandler } from './register';

export function registerNotesHandlers(): void {
  registerHandler(NotesChannels.getAll, async () => {
    throw new Error('Not implemented: notes:getAll');
  });

  registerHandler(NotesChannels.getById, async () => {
    throw new Error('Not implemented: notes:getById');
  });

  registerHandler(NotesChannels.create, async () => {
    throw new Error('Not implemented: notes:create');
  });

  registerHandler(NotesChannels.delete, async () => {
    throw new Error('Not implemented: notes:delete');
  });

  registerHandler(NotesChannels.rename, async () => {
    throw new Error('Not implemented: notes:rename');
  });

  registerHandler(NotesChannels.updateContent, async () => {
    throw new Error('Not implemented: notes:updateContent');
  });

  registerHandler(NotesChannels.getReferences, async () => {
    throw new Error('Not implemented: notes:getReferences');
  });

  registerHandler(NotesChannels.createReference, async () => {
    throw new Error('Not implemented: notes:createReference');
  });

  registerHandler(NotesChannels.getReference, async () => {
    throw new Error('Not implemented: notes:getReference');
  });

  registerHandler(NotesChannels.syncReferences, async () => {
    throw new Error('Not implemented: notes:syncReferences');
  });

  registerHandler(NotesChannels.updateReference, async () => {
    throw new Error('Not implemented: notes:updateReference');
  });

  registerHandler(NotesChannels.getBibleReferences, async () => {
    throw new Error('Not implemented: notes:getBibleReferences');
  });

  registerHandler(NotesChannels.createBibleReference, async () => {
    throw new Error('Not implemented: notes:createBibleReference');
  });

  registerHandler(NotesChannels.syncBibleReferences, async () => {
    throw new Error('Not implemented: notes:syncBibleReferences');
  });

  registerHandler(NotesChannels.addBibleVerse, async () => {
    throw new Error('Not implemented: notes:addBibleVerse');
  });

  registerHandler(NotesChannels.removeBibleVerse, async () => {
    throw new Error('Not implemented: notes:removeBibleVerse');
  });

  registerHandler(NotesChannels.exportPdf, async () => {
    throw new Error('Not implemented: notes:exportPdf');
  });
}
