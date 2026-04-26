import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        textPartLanguage: {
            setTextPartLanguage: (lang: string) => ReturnType;
            unsetTextPartLanguage: () => ReturnType;
        };
    }
}

export const TextPartLanguage = Mark.create({
    name: 'textPartLanguage',

    excludes: '',

    addAttributes() {
        return {
            lang: {
                default: null,
                parseHTML: (element) => element.getAttribute('lang'),
                renderHTML: (attributes) => (attributes.lang ? { lang: attributes.lang } : {}),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[lang]',
                getAttrs: (element) => {
                    if (!(element instanceof HTMLElement)) return false;
                    const lang = element.getAttribute('lang');
                    return lang ? { lang } : false;
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setTextPartLanguage:
                (lang: string) =>
                ({ commands }) =>
                    commands.setMark(this.name, { lang }),
            unsetTextPartLanguage:
                () =>
                ({ commands }) =>
                    commands.unsetMark(this.name),
        };
    },
});
