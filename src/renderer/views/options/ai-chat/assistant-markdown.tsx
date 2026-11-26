import { memo, useDeferredValue, useMemo, type ComponentProps } from 'react';
import { Typography } from 'antd';
import { PictureOutlined } from '@ant-design/icons';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toSafeExternalUrl } from '@shared/external-url';
import AiReferenceLink from './ai-reference-link';

const { Text } = Typography;
const MARKDOWN_REMARK_PLUGINS = [remarkGfm];

export function toChatMarkdownUrl(url: string): string | null {
    if (url.startsWith('wmb://')) {
        return url;
    }
    return toSafeExternalUrl(url);
}

function sanitizeWmbLinks(content: string): string {
    return content
        .replace(/`(\[[^\]]+\]\(wmb:\/\/[^)]+\))`/g, '$1')
        .replace(
            /\]\(wmb:\/\/([^)]+)\)/g,
            (_, path: string) => `](wmb://${path.replace(/ /g, '%20')})`,
        );
}

/**
 * Model output must not load remote content without a click, so an image shows
 * only its description. It stays plain text because it can sit inside a link.
 */
export function MarkdownImagePlaceholder({ src, alt }: ComponentProps<'img'> & { node?: unknown }) {
    const label = alt?.trim() || (typeof src === 'string' ? src : '');
    if (!label) return null;

    return (
        <Text type="secondary">
            <PictureOutlined /> {label}
        </Text>
    );
}

const markdownComponents = {
    a: AiReferenceLink,
    img: MarkdownImagePlaceholder,
    table: ({ children, node: _node, ...props }: ComponentProps<'table'> & { node?: unknown }) => (
        <div className="ai-markdown__table-wrap">
            <table {...props}>{children}</table>
        </div>
    ),
};

const AssistantMarkdown = memo(function AssistantMarkdown({
    content,
    streaming,
}: {
    content: string;
    streaming: boolean;
}) {
    const deferredContent = useDeferredValue(content);
    const markdownSource = useMemo(
        () => sanitizeWmbLinks(streaming ? deferredContent : content),
        [content, deferredContent, streaming],
    );

    return (
        <div className="ai-markdown">
            <Markdown
                remarkPlugins={MARKDOWN_REMARK_PLUGINS}
                components={markdownComponents}
                urlTransform={toChatMarkdownUrl}
            >
                {markdownSource}
            </Markdown>
        </div>
    );
});

export default AssistantMarkdown;
