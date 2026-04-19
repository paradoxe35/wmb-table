import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EditorContent from './notes/editor';
import { Notes } from './notes/notes';
import { useNotesStore } from '@renderer/stores';
import { getNotesPageHelp } from './components/option-help-content';
import OptionPageLayout from './components/option-page-layout';
import { AnimatePresence, motion } from 'framer-motion';

const pageTransition = {
    type: 'spring',
    stiffness: 320,
    damping: 30,
    mass: 0.9,
} as const;

const pageSwitchVariants = {
    enter: (direction: number) => ({
        opacity: 0,
        x: direction > 0 ? 28 : -28,
        scale: 0.985,
        filter: 'blur(4px)',
    }),
    center: {
        opacity: 1,
        x: 0,
        scale: 1,
        filter: 'blur(0px)',
    },
    exit: (direction: number) => ({
        opacity: 0,
        x: direction > 0 ? -24 : 24,
        scale: 0.99,
        filter: 'blur(2px)',
    }),
};

export default function Editor() {
    const { t } = useTranslation();
    const [workingNote, setWorkingNote] = useState<string | null>(null);
    const [direction, setDirection] = useState(1);
    const setWorkingNoteId = useNotesStore((s) => s.setWorkingNoteId);

    const openNote = useCallback((noteId: string) => {
        setDirection(1);
        setWorkingNote(noteId);
    }, []);

    const backToNotes = useCallback(() => {
        setDirection(-1);
        setWorkingNote(null);
    }, []);

    useEffect(() => {
        setWorkingNoteId(workingNote);
    }, [workingNote, setWorkingNoteId]);

    return (
        <div style={{ position: 'relative', overflow: 'hidden' }}>
            <AnimatePresence initial={false} mode="wait" custom={direction}>
                {workingNote ? (
                    <motion.div
                        key={`note-editor:${workingNote}`}
                        custom={direction}
                        variants={pageSwitchVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={pageTransition}
                    >
                        <EditorContent workingNoteId={workingNote} backToNotes={backToNotes} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="notes-list"
                        custom={direction}
                        variants={pageSwitchVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={pageTransition}
                    >
                        <OptionPageLayout title={t('Notes')} help={getNotesPageHelp(t)}>
                            <Notes setWorkingNote={openNote} />
                        </OptionPageLayout>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
