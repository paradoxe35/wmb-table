import { useCallback, useEffect, useState } from 'react';
import { Empty, List, Modal, Spin, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@renderer/stores';
import { useOpenDocument, useSermonLookup, useFormatSermonDate } from '@renderer/hooks';
import { CHILD_PARENT_WINDOW_EVENT } from '@renderer/utils/events';
import type { SimilarSermonHit } from '@shared/types';

const { Text } = Typography;

interface SimilarSermonsRequest {
    paragraphIndex: number;
    translationId: number;
    sermonId: string;
    languageCode: string;
    textSnippet: string;
}

export default function SimilarSermonsModal() {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [hits, setHits] = useState<SimilarSermonHit[]>([]);
    const [snippet, setSnippet] = useState('');
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const openDocument = useOpenDocument();
    const { getSermonById } = useSermonLookup();
    const formatDate = useFormatSermonDate();

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<SimilarSermonsRequest>).detail;
            if (!detail || !contentLanguage) return;

            setOpen(true);
            setLoading(true);
            setHits([]);
            setSnippet(detail.textSnippet);

            // Convert sermonId string (e.g. "61-1210") to numeric sermon_date
            const sermonDate = Number(detail.sermonId.replace(/[^0-9]/g, ''));

            window.api.search
                .findSimilarSermons(
                    contentLanguage,
                    detail.translationId,
                    sermonDate,
                    detail.paragraphIndex,
                    15,
                )
                .then((result) => setHits(result.hits as SimilarSermonHit[]))
                .catch(() => setHits([]))
                .finally(() => setLoading(false));
        };

        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.showSimilarSermons, handler);
        return () =>
            window.removeEventListener(CHILD_PARENT_WINDOW_EVENT.showSimilarSermons, handler);
    }, [contentLanguage]);

    const handleClick = useCallback(
        (hit: SimilarSermonHit) => {
            openDocument(hit.title, hit.sermonId, hit.translationId);
            setOpen(false);
        },
        [openDocument],
    );

    return (
        <Modal
            title={t('Prédications similaires')}
            open={open}
            onCancel={() => setOpen(false)}
            footer={null}
            width={600}
        >
            {snippet && (
                <Text type="secondary" italic style={{ display: 'block', marginBottom: 12 }}>
                    "{snippet}..."
                </Text>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <Spin />
                </div>
            ) : hits.length === 0 ? (
                <Empty description={t('Aucune prédication similaire trouvée')} />
            ) : (
                <List
                    dataSource={hits}
                    renderItem={(hit) => {
                        const sermon = getSermonById(hit.sermonId);
                        const displayTitle = sermon?.title ?? hit.title;
                        const dateStr = sermon?.dateMs ? formatDate(sermon.dateMs) : '';

                        return (
                            <List.Item
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleClick(hit)}
                            >
                                <List.Item.Meta
                                    title={<a className="underline">{displayTitle}</a>}
                                    description={
                                        dateStr
                                            ? `${dateStr}${sermon?.location ? ` — ${sermon.location}` : ''}`
                                            : undefined
                                    }
                                />
                                <Text type="secondary">
                                    {hit.hitCount}{' '}
                                    {hit.hitCount > 1 ? t('correspondances') : t('correspondance')}
                                </Text>
                            </List.Item>
                        );
                    }}
                />
            )}
        </Modal>
    );
}
