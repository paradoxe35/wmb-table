import { Link } from '@tiptap/extension-link';

export const ReferenceLink = Link.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            reference: {
                default: null,
                parseHTML: (element) => element.getAttribute('reference'),
                renderHTML: (attributes) =>
                    attributes.reference ? { reference: attributes.reference } : {},
            },
            bible: {
                default: null,
                parseHTML: (element) => element.getAttribute('bible'),
                renderHTML: (attributes) => (attributes.bible ? { bible: attributes.bible } : {}),
            },
            title: {
                default: null,
                parseHTML: (element) => element.getAttribute('title'),
                renderHTML: (attributes) => (attributes.title ? { title: attributes.title } : {}),
            },
        };
    },
});
