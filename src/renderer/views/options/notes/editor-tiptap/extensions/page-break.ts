import { mergeAttributes, Node } from '@tiptap/core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        pageBreak: {
            insertPageBreak: () => ReturnType;
        };
    }
}

export const PageBreak = Node.create({
    name: 'pageBreak',

    group: 'block',

    atom: true,

    selectable: true,

    parseHTML() {
        return [{ tag: 'div[data-page-break]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                class: 'page-break',
                'data-page-break': 'true',
            }),
        ];
    },

    addCommands() {
        return {
            insertPageBreak:
                () =>
                ({ commands }) =>
                    commands.insertContent({ type: this.name }),
        };
    },
});
