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
        return [
            { tag: 'div.page-break' },
            { tag: 'div[data-page-break]' },
            {
                tag: 'div',
                getAttrs: (node) => {
                    if (!(node instanceof HTMLElement)) return false;
                    const style = node.getAttribute('style') ?? '';
                    return /page-break-(?:after|before):\s*always/i.test(style) ? {} : false;
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                class: 'page-break',
                'data-page-break': 'true',
                style: 'page-break-after: always;',
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
