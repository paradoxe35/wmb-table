import { Empty, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { useFormatSermonDate } from '@renderer/hooks';

import type { BibleReferenceContent, DocReferenceContent, SermonReferenceContent } from './content';

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

export function SermonReferenceView({ content }: { content: SermonReferenceContent }) {
    const { t } = useTranslation();
    const formatDate = useFormatSermonDate();

    const metaLine =
        content.dateMs != null
            ? `${formatDate(content.dateMs)}${content.location ? ` — ${content.location}` : ''}`
            : (content.location ?? undefined);

    return (
        <ReferenceCard label={t('Sermon')} title={content.title} meta={metaLine}>
            {content.paragraphText ? (
                <>
                    {content.paragraphIndex != null && (
                        <Typography.Text strong>
                            {t('Paragraphe {{n}}', { n: content.paragraphIndex })}
                        </Typography.Text>
                    )}
                    <p className="wmb-reference__paragraph">{content.paragraphText}</p>
                </>
            ) : (
                <Typography.Text type="secondary">
                    {content.paragraphIndex != null
                        ? `${t('Paragraphe {{n}}', { n: content.paragraphIndex })} — ${t('Référence introuvable')}`
                        : t('Référence introuvable')}
                </Typography.Text>
            )}
        </ReferenceCard>
    );
}

export function BibleReferenceView({ content }: { content: BibleReferenceContent }) {
    const { t } = useTranslation();
    return (
        <ReferenceCard
            label={t('Bible')}
            title={content.label}
            meta={content.versionAbbreviation.toUpperCase()}
        >
            {content.verses.length === 0 ? (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t('Référence introuvable')}
                />
            ) : (
                content.verses.map((verse) => (
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

export function DocReferenceView({ content }: { content: DocReferenceContent }) {
    const { t } = useTranslation();
    return (
        <ReferenceCard label={t('Document personnalisé')} title={content.title}>
            {content.contentSnippet ? (
                <p className="wmb-reference__paragraph">{content.contentSnippet}</p>
            ) : (
                <Typography.Text type="secondary">
                    {t("Aucun document n'a été attribué pour cette référence")}
                </Typography.Text>
            )}
        </ReferenceCard>
    );
}
