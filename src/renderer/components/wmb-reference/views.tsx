import { Empty, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { useFormatSermonDate } from '@renderer/hooks';

import type { BibleReferenceData, DocReferenceData, SermonReferenceData } from './resolvers';

const DOC_PREVIEW_MAX_CHARS = 500;

function ReferenceCard({
    label,
    title,
    meta,
    children,
}: {
    label: string;
    title: string;
    meta?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
        >
            <div className="wmb-reference__label">{label}</div>
            <div className="wmb-reference__title">{title}</div>
            {meta && <div className="wmb-reference__meta">{meta}</div>}
            <div className="wmb-reference__body">{children}</div>
        </motion.div>
    );
}

function NotFoundEmpty() {
    const { t } = useTranslation();
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('Référence introuvable')} />;
}

export function SermonReferenceView({ data }: { data: SermonReferenceData }) {
    const { t } = useTranslation();
    const formatDate = useFormatSermonDate();
    const { meta, paragraph, ref } = data;

    if (!meta) return <NotFoundEmpty />;

    const metaLine = `${formatDate(meta.dateMs)}${meta.location ? ` — ${meta.location}` : ''}`;

    return (
        <ReferenceCard label={t('Sermon')} title={meta.title} meta={metaLine}>
            {paragraph ? (
                <>
                    <Typography.Text strong>
                        {t('Paragraphe {{n}}', { n: paragraph.paragraphIndex })}
                    </Typography.Text>
                    <p className="wmb-reference__paragraph">{paragraph.content}</p>
                </>
            ) : (
                <Typography.Text type="secondary">
                    {t('Paragraphe {{n}}', { n: ref.paragraphIndex })} —{' '}
                    {t('Référence introuvable')}
                </Typography.Text>
            )}
        </ReferenceCard>
    );
}

export function BibleReferenceView({ data }: { data: BibleReferenceData }) {
    const { t } = useTranslation();
    const { ref, verses } = data;

    const title = `${ref.bookName} ${ref.chapter}${ref.verse ? `:${ref.verse}` : ''}`;

    return (
        <ReferenceCard
            label={t('Bible')}
            title={title}
            meta={ref.bibleVersionAbbreviation.toUpperCase()}
        >
            {verses.length === 0 ? (
                <NotFoundEmpty />
            ) : (
                verses.map((verse) => (
                    <div key={verse.id} className="wmb-reference__verse">
                        <Typography.Text strong className="wmb-reference__verse-ref">
                            {verse.bookName} {verse.chapter}:{verse.verse}
                        </Typography.Text>{' '}
                        <span>{verse.content}</span>
                    </div>
                ))
            )}
        </ReferenceCard>
    );
}

export function DocReferenceView({ data }: { data: DocReferenceData }) {
    const { t } = useTranslation();
    const { ref, document } = data;

    if (!document) return <NotFoundEmpty />;

    const snippet =
        document.content.length > DOC_PREVIEW_MAX_CHARS
            ? `${document.content.slice(0, DOC_PREVIEW_MAX_CHARS).trimEnd()}…`
            : document.content;

    return (
        <ReferenceCard label={t('Document personnalisé')} title={document.title || ref.title}>
            <p className="wmb-reference__paragraph">{snippet}</p>
        </ReferenceCard>
    );
}
