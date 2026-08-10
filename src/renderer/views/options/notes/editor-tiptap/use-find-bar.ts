import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useAppStore } from '@renderer/stores';

function isFindShortcut(event: KeyboardEvent): boolean {
    return (
        (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key === 'f'
    );
}

export function useFindBar(editor: Editor | null) {
    const [open, setOpen] = useState(false);
    const isNotesVisible = useAppStore(
        (s) => s.mainView === 'options' && s.optionView === 'editor',
    );

    const close = useCallback(() => {
        setOpen(false);
        editor?.commands.clearSearch();
        editor?.commands.focus();
    }, [editor]);

    const toggle = useCallback(() => (open ? close() : setOpen(true)), [open, close]);

    useEffect(() => {
        if (!isNotesVisible) return;

        const handler = (event: KeyboardEvent) => {
            if (!isFindShortcut(event)) return;
            event.preventDefault();
            setOpen(true);
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isNotesVisible]);

    return { open, toggle, close };
}
