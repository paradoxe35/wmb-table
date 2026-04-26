import { TaskList, TaskItem } from '@tiptap/extension-list';

/**
 * Accepts CKEditor 5's todo-list markup in addition to Tiptap's native data-type form,
 * so existing notes saved by CKEditor render correctly when loaded into Tiptap.
 *
 * CKEditor output:
 *   <ul class="todo-list">
 *     <li>
 *       <label class="todo-list__label">
 *         <input type="checkbox" checked="checked"> <!-- omitted when unchecked -->
 *         <span class="todo-list__label__description">…</span>
 *       </label>
 *     </li>
 *   </ul>
 */
export const TaskListCompat = TaskList.extend({
    parseHTML() {
        return [{ tag: 'ul[data-type="taskList"]' }, { tag: 'ul.todo-list', priority: 51 }];
    },
});

export const TaskItemCompat = TaskItem.extend({
    parseHTML() {
        return [
            { tag: 'li[data-type="taskItem"]' },
            {
                tag: 'li',
                priority: 51,
                getAttrs: (node) => {
                    if (!(node instanceof HTMLElement)) return false;
                    if (!node.parentElement?.classList.contains('todo-list')) return false;
                    const checkbox = node.querySelector(
                        'input[type="checkbox"], label.todo-list__label input',
                    ) as HTMLInputElement | null;
                    return { checked: !!checkbox?.checked };
                },
            },
        ];
    },
});
