import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        indent: {
            indent: () => ReturnType;
            outdent: () => ReturnType;
        };
    }
}

const INDENT_TYPES = ['paragraph', 'heading', 'blockquote'];
const INDENT_STEP = 2; // em
const MAX_INDENT = 10;

function parseIndent(style: string | null): number {
    if (!style) return 0;
    const match = /margin-left:\s*(-?\d+(?:\.\d+)?)em/i.exec(style);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    return Number.isFinite(value) ? Math.round(value / INDENT_STEP) : 0;
}

export const Indent = Extension.create({
    name: 'indent',

    addGlobalAttributes() {
        return [
            {
                types: INDENT_TYPES,
                attributes: {
                    indent: {
                        default: 0,
                        parseHTML: (element) => parseIndent(element.getAttribute('style')),
                        renderHTML: (attributes) => {
                            const level = Number(attributes.indent) || 0;
                            if (!level) return {};
                            return { style: `margin-left: ${level * INDENT_STEP}em` };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        const updateIndent = (delta: 1 | -1) => {
            return ({
                tr,
                state,
                dispatch,
            }: {
                tr: import('@tiptap/pm/state').Transaction;
                state: import('@tiptap/pm/state').EditorState;
                dispatch?: (tr: import('@tiptap/pm/state').Transaction) => void;
            }) => {
                const { from, to } = state.selection;
                let changed = false;

                state.doc.nodesBetween(from, to, (node, pos) => {
                    if (!INDENT_TYPES.includes(node.type.name)) return;
                    const current = Number(node.attrs.indent) || 0;
                    const next = Math.max(0, Math.min(MAX_INDENT, current + delta));
                    if (next === current) return;
                    tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
                    changed = true;
                });

                if (changed && dispatch) {
                    dispatch(tr);
                }
                return changed;
            };
        };

        return {
            indent:
                () =>
                ({ editor, commands, tr, state, dispatch }) => {
                    if (editor.isActive('listItem')) {
                        return commands.sinkListItem('listItem');
                    }
                    if (editor.isActive('taskItem')) {
                        return commands.sinkListItem('taskItem');
                    }
                    return updateIndent(1)({ tr, state, dispatch });
                },
            outdent:
                () =>
                ({ editor, commands, tr, state, dispatch }) => {
                    if (editor.isActive('listItem')) {
                        return commands.liftListItem('listItem');
                    }
                    if (editor.isActive('taskItem')) {
                        return commands.liftListItem('taskItem');
                    }
                    return updateIndent(-1)({ tr, state, dispatch });
                },
        };
    },

    addKeyboardShortcuts() {
        return {
            Tab: () => this.editor.commands.indent(),
            'Shift-Tab': () => this.editor.commands.outdent(),
        };
    },
});
