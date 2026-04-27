import { useCallback, useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { Button, ColorPicker, Divider, Select, Tooltip } from 'antd';
import {
    BoldOutlined,
    ItalicOutlined,
    UnderlineOutlined,
    StrikethroughOutlined,
    DeleteOutlined,
    DeleteColumnOutlined,
    DeleteRowOutlined,
    InsertRowBelowOutlined,
    InsertRowRightOutlined,
    MergeCellsOutlined,
    OrderedListOutlined,
    UnorderedListOutlined,
    CheckSquareOutlined,
    AlignLeftOutlined,
    AlignCenterOutlined,
    AlignRightOutlined,
    MenuOutlined,
    TableOutlined,
    SplitCellsOutlined,
    UndoOutlined,
    RedoOutlined,
    MinusOutlined,
    FileTextOutlined,
    BgColorsOutlined,
    FontColorsOutlined,
    FontSizeOutlined,
    CodeOutlined,
    ClearOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { TEXT_PART_LANGUAGE_OPTIONS } from '@shared/constants';
import { BlockquoteIcon } from './icons';
import { LinkPopoverButton } from './link-popover-button';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const HEADING_LEVELS: HeadingLevel[] = [1, 2, 3, 4, 5, 6];

const FONT_FAMILIES = [
    { label: 'Default', value: '' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Tahoma', value: 'Tahoma, sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", serif' },
    { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Courier New', value: '"Courier New", monospace' },
];

const FONT_SIZES = [
    { label: 'Default', value: '' },
    { label: '10', value: '10pt' },
    { label: '12', value: '12pt' },
    { label: '14', value: '14pt' },
    { label: '16', value: '16pt' },
    { label: '18', value: '18pt' },
    { label: '20', value: '20pt' },
    { label: '24', value: '24pt' },
    { label: '28', value: '28pt' },
    { label: '32', value: '32pt' },
    { label: '40', value: '40pt' },
    { label: '48', value: '48pt' },
];

const SMALL_BUTTON_STYLE: React.CSSProperties = { padding: '0 8px' };

export function EditorToolbar({ editor }: { editor: Editor }) {
    const { t } = useTranslation();

    const state = useEditorState({
        editor,
        selector: ({ editor: ed }) => ({
            isBold: ed.isActive('bold'),
            isItalic: ed.isActive('italic'),
            isUnderline: ed.isActive('underline'),
            isStrike: ed.isActive('strike'),
            isSubscript: ed.isActive('subscript'),
            isSuperscript: ed.isActive('superscript'),
            isBulletList: ed.isActive('bulletList'),
            isOrderedList: ed.isActive('orderedList'),
            isTaskList: ed.isActive('taskList'),
            isTable: ed.isActive('table'),
            isBlockquote: ed.isActive('blockquote'),
            isCode: ed.isActive('code'),
            isCodeBlock: ed.isActive('codeBlock'),
            isLink: ed.isActive('link'),
            alignLeft: ed.isActive({ textAlign: 'left' }),
            alignCenter: ed.isActive({ textAlign: 'center' }),
            alignRight: ed.isActive({ textAlign: 'right' }),
            alignJustify: ed.isActive({ textAlign: 'justify' }),
            headingLevel: HEADING_LEVELS.find((level) => ed.isActive('heading', { level })) ?? 0,
            fontFamily: (ed.getAttributes('textStyle').fontFamily as string | undefined) ?? '',
            fontSize: (ed.getAttributes('textStyle').fontSize as string | undefined) ?? '',
            color: (ed.getAttributes('textStyle').color as string | undefined) ?? '',
            backgroundColor:
                (ed.getAttributes('textStyle').backgroundColor as string | undefined) ?? '',
            textPartLanguage:
                (ed.getAttributes('textPartLanguage').lang as string | undefined) ?? '',
            canUndo: ed.can().undo(),
            canRedo: ed.can().redo(),
            canDeleteTable: ed.can().deleteTable(),
            canAddRowAfter: ed.can().addRowAfter(),
            canAddColumnAfter: ed.can().addColumnAfter(),
            canDeleteRow: ed.can().deleteRow(),
            canDeleteColumn: ed.can().deleteColumn(),
            canMergeCells: ed.can().mergeCells(),
            canSplitCell: ed.can().splitCell(),
        }),
    });

    const headingValue = state.headingLevel === 0 ? 'p' : `h${state.headingLevel}`;

    const onHeadingChange = useCallback(
        (value: string) => {
            if (value === 'p') {
                editor.chain().focus().setParagraph().run();
                return;
            }
            const level = Number(value.slice(1)) as HeadingLevel;
            editor.chain().focus().toggleHeading({ level }).run();
        },
        [editor],
    );

    const onFontFamilyChange = useCallback(
        (value: string) => {
            const chain = editor.chain().focus();
            if (!value) {
                chain.unsetFontFamily().run();
            } else {
                chain.setFontFamily(value).run();
            }
        },
        [editor],
    );

    const onFontSizeChange = useCallback(
        (value: string) => {
            const chain = editor.chain().focus();
            if (!value) {
                chain.unsetFontSize().run();
            } else {
                chain.setFontSize(value).run();
            }
        },
        [editor],
    );

    const onColorChange = useCallback(
        (value: string) => {
            const chain = editor.chain().focus();
            if (!value) {
                chain.unsetColor().run();
            } else {
                chain.setColor(value).run();
            }
        },
        [editor],
    );

    const onBackgroundColorChange = useCallback(
        (value: string) => {
            const chain = editor.chain().focus();
            if (!value) {
                chain.unsetBackgroundColor().run();
            } else {
                chain.setBackgroundColor(value).run();
            }
        },
        [editor],
    );

    const onInsertTable = useCallback(() => {
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }, [editor]);

    const onTextPartLanguageChange = useCallback(
        (value: string) => {
            const chain = editor.chain().focus();
            if (!value) {
                chain.unsetTextPartLanguage().run();
            } else {
                chain.setTextPartLanguage(value).run();
            }
        },
        [editor],
    );

    const headingOptions = useMemo(
        () => [
            { value: 'p', label: t('Paragraphe') },
            ...HEADING_LEVELS.map((level) => ({
                value: `h${level}`,
                label: t('Titre {{n}}', { n: level }),
            })),
        ],
        [t],
    );

    const fontFamilyOptions = useMemo(
        () => [
            { label: t('Par défaut'), value: '' },
            ...FONT_FAMILIES.filter((option) => option.value),
        ],
        [t],
    );

    const fontSizeOptions = useMemo(
        () => [
            { label: t('Par défaut'), value: '' },
            ...FONT_SIZES.filter((option) => option.value),
        ],
        [t],
    );

    const languageOptions = useMemo(
        () => [
            { value: '', label: t('Langue par défaut') },
            ...TEXT_PART_LANGUAGE_OPTIONS.map((option) => ({
                value: option.languageCode,
                label: option.title,
            })),
        ],
        [t],
    );

    return (
        <div className="tiptap-toolbar">
            <Tooltip title={t('Annuler la modification')}>
                <Button
                    type="text"
                    size="small"
                    icon={<UndoOutlined />}
                    disabled={!state.canUndo}
                    onClick={() => editor.chain().focus().undo().run()}
                />
            </Tooltip>
            <Tooltip title={t('Rétablir')}>
                <Button
                    type="text"
                    size="small"
                    icon={<RedoOutlined />}
                    disabled={!state.canRedo}
                    onClick={() => editor.chain().focus().redo().run()}
                />
            </Tooltip>

            <Divider type="vertical" />

            <Tooltip title={t('Style de paragraphe')}>
                <Select
                    size="small"
                    style={{ width: 130 }}
                    value={headingValue}
                    options={headingOptions}
                    onChange={onHeadingChange}
                />
            </Tooltip>

            <Tooltip title={t('Police')}>
                <Select
                    size="small"
                    style={{ width: 140 }}
                    value={state.fontFamily}
                    options={fontFamilyOptions}
                    onChange={onFontFamilyChange}
                    suffixIcon={<FontColorsOutlined />}
                />
            </Tooltip>

            <Tooltip title={t('Taille de la police')}>
                <Select
                    size="small"
                    style={{ width: 90 }}
                    value={state.fontSize}
                    options={fontSizeOptions}
                    onChange={onFontSizeChange}
                    suffixIcon={<FontSizeOutlined />}
                />
            </Tooltip>

            <Divider type="vertical" />

            <Tooltip title={t('Gras')}>
                <Button
                    type={state.isBold ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<BoldOutlined />}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                />
            </Tooltip>
            <Tooltip title={t('Italique')}>
                <Button
                    type={state.isItalic ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<ItalicOutlined />}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                />
            </Tooltip>
            <Tooltip title={t('Souligné')}>
                <Button
                    type={state.isUnderline ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<UnderlineOutlined />}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                />
            </Tooltip>
            <Tooltip title={t('Barré')}>
                <Button
                    type={state.isStrike ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<StrikethroughOutlined />}
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                />
            </Tooltip>
            <Tooltip title={t('Code en ligne')}>
                <Button
                    type={state.isCode ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<CodeOutlined />}
                    onClick={() => editor.chain().focus().toggleCode().run()}
                />
            </Tooltip>

            <Divider type="vertical" />

            <Tooltip title={t('Indice')}>
                <Button
                    type={state.isSubscript ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    onClick={() => editor.chain().focus().toggleSubscript().run()}
                >
                    X₂
                </Button>
            </Tooltip>
            <Tooltip title={t('Exposant')}>
                <Button
                    type={state.isSuperscript ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    onClick={() => editor.chain().focus().toggleSuperscript().run()}
                >
                    X²
                </Button>
            </Tooltip>

            <Divider type="vertical" />

            <ColorPicker
                size="small"
                value={state.color || '#000000'}
                onChangeComplete={(c) => onColorChange(c.toHexString())}
                allowClear
                onClear={() => onColorChange('')}
            >
                <Tooltip title={t('Couleur du texte')}>
                    <Button type="text" size="small" icon={<FontColorsOutlined />} />
                </Tooltip>
            </ColorPicker>
            <ColorPicker
                size="small"
                value={state.backgroundColor || '#ffff00'}
                onChangeComplete={(c) => onBackgroundColorChange(c.toHexString())}
                allowClear
                onClear={() => onBackgroundColorChange('')}
            >
                <Tooltip title={t('Surlignage')}>
                    <Button type="text" size="small" icon={<BgColorsOutlined />} />
                </Tooltip>
            </ColorPicker>

            <Divider type="vertical" />

            <Tooltip title={t('Aligner à gauche')}>
                <Button
                    type={state.alignLeft ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<AlignLeftOutlined />}
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                />
            </Tooltip>
            <Tooltip title={t('Centrer')}>
                <Button
                    type={state.alignCenter ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<AlignCenterOutlined />}
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                />
            </Tooltip>
            <Tooltip title={t('Aligner à droite')}>
                <Button
                    type={state.alignRight ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<AlignRightOutlined />}
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                />
            </Tooltip>
            <Tooltip title={t('Justifier')}>
                <Button
                    type={state.alignJustify ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<MenuOutlined />}
                    onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                />
            </Tooltip>

            <Divider type="vertical" />

            <Tooltip title={t('Liste à puces')}>
                <Button
                    type={state.isBulletList ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<UnorderedListOutlined />}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                />
            </Tooltip>
            <Tooltip title={t('Liste numérotée')}>
                <Button
                    type={state.isOrderedList ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<OrderedListOutlined />}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                />
            </Tooltip>
            <Tooltip title={t('Liste de tâches')}>
                <Button
                    type={state.isTaskList ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<CheckSquareOutlined />}
                    onClick={() => editor.chain().focus().toggleTaskList().run()}
                />
            </Tooltip>

            <Divider type="vertical" />

            <Tooltip title={t('Réduire le retrait')}>
                <Button
                    type="text"
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    onClick={() => editor.chain().focus().outdent().run()}
                >
                    {'⇤'}
                </Button>
            </Tooltip>
            <Tooltip title={t('Augmenter le retrait')}>
                <Button
                    type="text"
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    onClick={() => editor.chain().focus().indent().run()}
                >
                    {'⇥'}
                </Button>
            </Tooltip>

            <Divider type="vertical" />

            <LinkPopoverButton
                editor={editor}
                active={state.isLink}
                buttonStyle={SMALL_BUTTON_STYLE}
            />
            <Tooltip title={t('Citation')}>
                <Button
                    type={state.isBlockquote ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<BlockquoteIcon />}
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                />
            </Tooltip>
            <Tooltip title={t('Bloc de code')}>
                <Button
                    type={state.isCodeBlock ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                >
                    {'</>'}
                </Button>
            </Tooltip>
            <Tooltip title={t('Insérer un tableau')}>
                <Button
                    type="text"
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<TableOutlined />}
                    onClick={onInsertTable}
                />
            </Tooltip>
            {state.isTable ? (
                <>
                    <Tooltip title={t('Ajouter une ligne')}>
                        <Button
                            type="text"
                            size="small"
                            style={SMALL_BUTTON_STYLE}
                            icon={<InsertRowBelowOutlined />}
                            disabled={!state.canAddRowAfter}
                            onClick={() => editor.chain().focus().addRowAfter().run()}
                        />
                    </Tooltip>
                    <Tooltip title={t('Ajouter une colonne')}>
                        <Button
                            type="text"
                            size="small"
                            style={SMALL_BUTTON_STYLE}
                            icon={<InsertRowRightOutlined />}
                            disabled={!state.canAddColumnAfter}
                            onClick={() => editor.chain().focus().addColumnAfter().run()}
                        />
                    </Tooltip>
                    <Tooltip title={t('Supprimer la ligne')}>
                        <Button
                            type="text"
                            size="small"
                            style={SMALL_BUTTON_STYLE}
                            icon={<DeleteRowOutlined />}
                            disabled={!state.canDeleteRow}
                            onClick={() => editor.chain().focus().deleteRow().run()}
                        />
                    </Tooltip>
                    <Tooltip title={t('Supprimer la colonne')}>
                        <Button
                            type="text"
                            size="small"
                            style={SMALL_BUTTON_STYLE}
                            icon={<DeleteColumnOutlined />}
                            disabled={!state.canDeleteColumn}
                            onClick={() => editor.chain().focus().deleteColumn().run()}
                        />
                    </Tooltip>
                    <Tooltip title={t('Fusionner les cellules')}>
                        <Button
                            type="text"
                            size="small"
                            style={SMALL_BUTTON_STYLE}
                            icon={<MergeCellsOutlined />}
                            disabled={!state.canMergeCells}
                            onClick={() => editor.chain().focus().mergeCells().run()}
                        />
                    </Tooltip>
                    <Tooltip title={t('Séparer la cellule')}>
                        <Button
                            type="text"
                            size="small"
                            style={SMALL_BUTTON_STYLE}
                            icon={<SplitCellsOutlined />}
                            disabled={!state.canSplitCell}
                            onClick={() => editor.chain().focus().splitCell().run()}
                        />
                    </Tooltip>
                    <Tooltip title={t('Supprimer le tableau')}>
                        <Button
                            danger
                            type="text"
                            size="small"
                            style={SMALL_BUTTON_STYLE}
                            icon={<DeleteOutlined />}
                            disabled={!state.canDeleteTable}
                            onClick={() => editor.chain().focus().deleteTable().run()}
                        />
                    </Tooltip>
                </>
            ) : null}
            <Tooltip title={t('Ligne horizontale')}>
                <Button
                    type="text"
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<MinusOutlined />}
                    onClick={() => editor.chain().focus().setHorizontalRule().run()}
                />
            </Tooltip>
            <Tooltip title={t('Saut de page')}>
                <Button
                    type="text"
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<FileTextOutlined />}
                    onClick={() => editor.chain().focus().insertPageBreak().run()}
                />
            </Tooltip>
            <Tooltip title={t('Effacer la mise en forme')}>
                <Button
                    type="text"
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={<ClearOutlined />}
                    onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                />
            </Tooltip>

            <Divider type="vertical" />

            <Tooltip title={t('Langue du texte')}>
                <Select
                    size="small"
                    style={{ width: 140 }}
                    value={state.textPartLanguage}
                    options={languageOptions}
                    onChange={onTextPartLanguageChange}
                    placeholder={t('Langue')}
                />
            </Tooltip>
        </div>
    );
}
