import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        underline: {
            setUnderline: () => ReturnType;
            toggleUnderline: () => ReturnType;
            unsetUnderline: () => ReturnType;
        };
    }
}

function hasUnderlineStyle(element: HTMLElement): boolean {
    const textDecoration = element.style.textDecoration || element.style.textDecorationLine || '';
    return textDecoration.toLowerCase().includes('underline');
}

export const Underline = Mark.create({
    name: 'underline',

    parseHTML() {
        return [
            { tag: 'u' },
            {
                tag: 'span',
                getAttrs: (element) => {
                    if (!(element instanceof HTMLElement)) return false;
                    return hasUnderlineStyle(element) ? null : false;
                },
            },
            {
                style: 'text-decoration',
                getAttrs: (value) =>
                    typeof value === 'string' && value.toLowerCase().includes('underline')
                        ? null
                        : false,
            },
            {
                style: 'text-decoration-line',
                getAttrs: (value) =>
                    typeof value === 'string' && value.toLowerCase().includes('underline')
                        ? null
                        : false,
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['u', mergeAttributes(HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setUnderline:
                () =>
                ({ commands }) =>
                    commands.setMark(this.name),
            toggleUnderline:
                () =>
                ({ commands }) =>
                    commands.toggleMark(this.name),
            unsetUnderline:
                () =>
                ({ commands }) =>
                    commands.unsetMark(this.name),
        };
    },

    addKeyboardShortcuts() {
        return {
            'Mod-u': () => this.editor.commands.toggleUnderline(),
        };
    },
});
