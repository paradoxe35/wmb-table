import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import {
    CloseOutlined,
    DownOutlined,
    FontSizeOutlined,
    SwapOutlined,
    UpOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';

function selectedText(editor: Editor): string {
    const { from, to } = editor.state.selection;
    return from === to ? '' : editor.state.doc.textBetween(from, to, ' ').trim();
}

export function EditorFindBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
    const { t } = useTranslation();
    const searchInputRef = useRef<InputRef>(null);
    const [replaceVisible, setReplaceVisible] = useState(false);

    const { total, currentIndex, caseSensitive, hasSearchTerm } = useEditorState({
        editor,
        selector: ({ editor: ed }) => ({
            total: ed.storage.findAndReplace.results.length,
            currentIndex: ed.storage.findAndReplace.currentIndex,
            caseSensitive: ed.storage.findAndReplace.caseSensitive,
            hasSearchTerm: ed.storage.findAndReplace.searchTerm.length > 0,
        }),
    });

    useEffect(() => {
        const initialTerm = selectedText(editor);
        if (initialTerm) {
            editor.commands.setSearchTerm(initialTerm);
        }
        searchInputRef.current?.focus({ cursor: 'all' });
        if (searchInputRef.current?.input) {
            searchInputRef.current.input.value = initialTerm;
        }
    }, [editor]);

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== 'Enter') return;

            event.preventDefault();
            if (event.shiftKey) {
                editor.commands.goToPreviousResult();
            } else {
                editor.commands.goToNextResult();
            }
        },
        [editor, onClose],
    );

    const resultLabel = () => {
        if (total > 0) return `${(currentIndex ?? 0) + 1} / ${total}`;
        return hasSearchTerm ? t('Aucun résultat') : '';
    };

    return (
        <div className="editor-find-bar">
            <div className="editor-find-bar__row">
                <Input
                    ref={searchInputRef}
                    size="small"
                    placeholder={t('Rechercher dans la note…')}
                    onChange={(e) => editor.commands.setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={{ width: 240 }}
                    allowClear
                />
                <span className="editor-find-bar__counter">{resultLabel()}</span>
                <Tooltip title={t('Respecter la casse')}>
                    <Button
                        type={caseSensitive ? 'primary' : 'text'}
                        size="small"
                        icon={<FontSizeOutlined />}
                        onClick={() => editor.commands.setCaseSensitive(!caseSensitive)}
                    />
                </Tooltip>
                <Tooltip title={t('Résultat précédent')}>
                    <Button
                        type="text"
                        size="small"
                        icon={<UpOutlined />}
                        disabled={total === 0}
                        onClick={() => editor.commands.goToPreviousResult()}
                    />
                </Tooltip>
                <Tooltip title={t('Résultat suivant')}>
                    <Button
                        type="text"
                        size="small"
                        icon={<DownOutlined />}
                        disabled={total === 0}
                        onClick={() => editor.commands.goToNextResult()}
                    />
                </Tooltip>
                <Tooltip title={t('Remplacer')}>
                    <Button
                        type={replaceVisible ? 'primary' : 'text'}
                        size="small"
                        icon={<SwapOutlined />}
                        onClick={() => setReplaceVisible((visible) => !visible)}
                    />
                </Tooltip>
                <Tooltip title={t('Fermer')}>
                    <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
                </Tooltip>
            </div>

            {replaceVisible && (
                <div className="editor-find-bar__row">
                    <Input
                        size="small"
                        placeholder={t('Remplacer par…')}
                        onChange={(e) => editor.commands.setReplaceTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{ width: 240 }}
                    />
                    <Button
                        size="small"
                        disabled={total === 0}
                        onClick={() => editor.commands.replace()}
                    >
                        {t('Remplacer')}
                    </Button>
                    <Button
                        size="small"
                        disabled={total === 0}
                        onClick={() => editor.commands.replaceAll()}
                    >
                        {t('Tout remplacer')}
                    </Button>
                </div>
            )}
        </div>
    );
}
