/** Tools that change the user's notes or subjects; every other tool only reads. */
export const WRITE_TOOL_NAMES: ReadonlySet<string> = new Set([
    'createNote',
    'editNote',
    'appendToNote',
    'updateNoteContent',
    'createSubject',
    'addSermonReferenceToSubject',
    'addBibleReferenceToSubject',
    'removeSubjectReference',
]);

export function isWriteTool(name: string): boolean {
    return WRITE_TOOL_NAMES.has(name);
}
