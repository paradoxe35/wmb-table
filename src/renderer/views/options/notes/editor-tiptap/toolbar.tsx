import { useCallback, useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { Button, ColorPicker, Divider, Select, Tooltip } from 'antd';
import {
    BoldOutlined,
    ItalicOutlined,
    UnderlineOutlined,
    StrikethroughOutlined,
    OrderedListOutlined,
    UnorderedListOutlined,
    CheckSquareOutlined,
    AlignLeftOutlined,
    AlignCenterOutlined,
    AlignRightOutlined,
    MenuOutlined,
    LinkOutlined,
    DisconnectOutlined,
    TableOutlined,
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

    const onLinkClick = useCallback(() => {
        if (editor.isActive('link')) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        const previous = editor.getAttributes('link').href as string | undefined;
        const url = window.prompt(t('Adresse du lien'), previous ?? 'https://');
        if (url == null) return;
        const trimmed = url.trim();
        if (!trimmed) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor
            .chain()
            .focus()
            .extendMarkRange('link')
            .setLink({ href: trimmed, target: '_blank' })
            .run();
    }, [editor, t]);

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
            ...HEADING_LEVELS.map((level) => ({ value: `h${level}`, label: `H${level}` })),
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

            <Select
                size="small"
                style={{ width: 130 }}
                value={headingValue}
                options={headingOptions}
                onChange={onHeadingChange}
            />

            <Select
                size="small"
                style={{ width: 140 }}
                value={state.fontFamily}
                options={FONT_FAMILIES}
                onChange={onFontFamilyChange}
                suffixIcon={<FontColorsOutlined />}
            />

            <Select
                size="small"
                style={{ width: 90 }}
                value={state.fontSize}
                options={FONT_SIZES}
                onChange={onFontSizeChange}
                suffixIcon={<FontSizeOutlined />}
            />

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

            <Tooltip title={t('Couleur du texte')}>
                <ColorPicker
                    size="small"
                    value={state.color || '#000000'}
                    onChangeComplete={(c) => onColorChange(c.toHexString())}
                    allowClear
                    onClear={() => onColorChange('')}
                >
                    <Button type="text" size="small" icon={<FontColorsOutlined />} />
                </ColorPicker>
            </Tooltip>
            <Tooltip title={t('Surlignage')}>
                <ColorPicker
                    size="small"
                    value={state.backgroundColor || '#ffff00'}
                    onChangeComplete={(c) => onBackgroundColorChange(c.toHexString())}
                    allowClear
                    onClear={() => onBackgroundColorChange('')}
                >
                    <Button type="text" size="small" icon={<BgColorsOutlined />} />
                </ColorPicker>
            </Tooltip>

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

            <Tooltip title={state.isLink ? t('Supprimer le lien') : t('Ajouter un lien')}>
                <Button
                    type={state.isLink ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    icon={state.isLink ? <DisconnectOutlined /> : <LinkOutlined />}
                    onClick={onLinkClick}
                />
            </Tooltip>
            <Tooltip title={t('Citation')}>
                <Button
                    type={state.isBlockquote ? 'primary' : 'text'}
                    size="small"
                    style={SMALL_BUTTON_STYLE}
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                >
                    {'❝'}
                </Button>
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

            <Select
                size="small"
                style={{ width: 140 }}
                value={state.textPartLanguage}
                options={languageOptions}
                onChange={onTextPartLanguageChange}
                placeholder={t('Langue')}
            />
        </div>
    );
}
