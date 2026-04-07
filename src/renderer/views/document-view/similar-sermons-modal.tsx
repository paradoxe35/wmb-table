import { useCallback, useEffect, useRef, useState } from 'react';
import { Empty, List, Modal, Pagination, Spin, Typography, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useDocumentTabsStore } from '@renderer/stores';
import {
    buildPendingNavigation,
    useDocumentPresentation,
    useFormatSermonDate,
    useOpenDocumentRequest,
    useSermonLookup,
} from '@renderer/hooks';
import { CHILD_PARENT_WINDOW_EVENT, type ShowSimilarSermonsDetail } from '@renderer/utils/events';
import {
    buildParagraphReference,
    buildSermonDocumentIdentity,
    type SimilarSermonHit,
} from '@shared/types';

const { Text } = Typography;
const PAGE_SIZE = 10;

export default function SimilarSermonsModal() {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [allHits, setAllHits] = useState<SimilarSermonHit[]>([]);
    const [page, setPage] = useState(1);
    const [snippet, setSnippet] = useState('');
    const listElRef = useRef<HTMLDivElement | null>(null);

    const { buildOpenRequest, resolveTitle } = useDocumentPresentation();
    const openDocumentRequest = useOpenDocumentRequest();
    const setPendingNavigation = useDocumentTabsStore((s) => s.setPendingNavigation);
    const { getSermonById } = useSermonLookup();
    const formatDate = useFormatSermonDate();

    useEffect(() => {
        let requestToken = 0;

        const handler = (e: CustomEventInit<ShowSimilarSermonsDetail>) => {
            const detail = e.detail;
            if (!detail) return;
            if (!detail.languageCode) return;

            requestToken += 1;
            const currentRequestToken = requestToken;
            setOpen(true);
            setLoading(true);
            setAllHits([]);
            setPage(1);
            setSnippet(detail.textSnippet);

            window.api.search
                .findSimilarSermons(
                    detail.languageCode,
                    detail.translationId,
                    detail.sermonDate,
                    detail.paragraphIndex,
                    50,
                )
                .then((result) => {
                    if (currentRequestToken !== requestToken) {
                        return;
                    }

                    setAllHits(result.hits as SimilarSermonHit[]);
                })
                .catch(() => {
                    if (currentRequestToken !== requestToken) {
                        return;
                    }

                    setAllHits([]);
                    message.error(t('Erreur lors de la recherche'));
                })
                .finally(() => {
                    if (currentRequestToken !== requestToken) {
                        return;
                    }

                    setLoading(false);
                });
        };

        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.showSimilarSermons, handler);
        return () => {
            requestToken += 1;
            window.removeEventListener(CHILD_PARENT_WINDOW_EVENT.showSimilarSermons, handler);
        };
    }, [t]);

    const handleNavigate = useCallback(
        (hit: SimilarSermonHit, paragraphIndex: number) => {
            if (!hit.languageCode) {
                return;
            }

            const documentIdentity = buildSermonDocumentIdentity(
                hit.sermonId,
                hit.translationId,
                hit.languageCode,
            );
            const request = buildOpenRequest(hit.title, documentIdentity);
            setPendingNavigation(
                buildPendingNavigation(
                    request,
                    buildParagraphReference(documentIdentity, paragraphIndex),
                ),
            );
            openDocumentRequest(request);
            setOpen(false);
        },
        [buildOpenRequest, openDocumentRequest, setPendingNavigation],
    );

    const handleClose = useCallback(() => {
        setOpen(false);
        setAllHits([]);
        setSnippet('');
    }, []);

    const pagedHits = allHits.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const modalBodyStyle = {
        display: 'flex',
        flexDirection: 'column' as const,
        maxHeight: 'min(78vh, 760px)',
        overflow: 'hidden',
    };
    const scrollAreaStyle = {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto' as const,
        paddingRight: 4,
    };

    return (
        <Modal
            title={t('Prédications similaires')}
            open={open}
            onCancel={handleClose}
            footer={null}
            width={650}
            centered
            destroyOnClose
            style={{ maxWidth: 'calc(100vw - 32px)' }}
            styles={{ body: modalBodyStyle }}
        >
            {snippet && (
                <div
                    style={{
                        marginBottom: 12,
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: 'var(--ant-color-fill-quaternary)',
                    }}
                >
                    <Text type="secondary" italic>
                        &ldquo;{snippet}&rdquo;
                    </Text>
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <Spin />
                </div>
            ) : allHits.length === 0 ? (
                <Empty description={t('Aucune prédication similaire trouvée')} />
            ) : (
                <>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                        {t('Trouvé dans {{count}} documents', { count: allHits.length })}
                    </Text>

                    <div style={scrollAreaStyle} ref={listElRef}>
                        <List
                            dataSource={pagedHits}
                            renderItem={(hit) => {
                                const sermon = getSermonById(hit.sermonId);
                                const displayTitle = hit.languageCode
                                    ? resolveTitle(
                                          hit.title,
                                          buildSermonDocumentIdentity(
                                              hit.sermonId,
                                              hit.translationId,
                                              hit.languageCode,
                                          ),
                                      )
                                    : hit.title;

                                const dateStr = sermon?.dateMs ? formatDate(sermon.dateMs) : '';
                                const subtitle = dateStr
                                    ? `${dateStr}${sermon?.location ? ` — ${sermon.location}` : ''}`
                                    : undefined;

                                return (
                                    <List.Item
                                        style={{
                                            flexDirection: 'column',
                                            alignItems: 'stretch',
                                            padding: '8px 0',
                                        }}
                                    >
                                        <div style={{ marginBottom: 4 }}>
                                            <Text strong style={{ fontSize: 'var(--fs-base)' }}>
                                                {displayTitle}
                                            </Text>
                                            {subtitle && (
                                                <Text
                                                    type="secondary"
                                                    style={{
                                                        fontSize: 'var(--fs-rel-xl)',
                                                        marginLeft: 8,
                                                    }}
                                                >
                                                    {subtitle}
                                                </Text>
                                            )}
                                        </div>
                                        {hit.paragraphs.map((p) => (
                                            <div
                                                key={p.paragraphIndex}
                                                onClick={() =>
                                                    handleNavigate(hit, p.paragraphIndex)
                                                }
                                                className="similar-paragraph-row"
                                                style={{
                                                    cursor: 'pointer',
                                                    padding: '4px 8px',
                                                    marginBottom: 2,
                                                    borderRadius: 4,
                                                    borderLeft:
                                                        '3px solid var(--ant-color-primary)',
                                                    transition: 'background 0.15s',
                                                }}
                                                onMouseEnter={(e) =>
                                                    (e.currentTarget.style.background =
                                                        'var(--ant-color-fill-quaternary)')
                                                }
                                                onMouseLeave={(e) =>
                                                    (e.currentTarget.style.background = '')
                                                }
                                            >
                                                <Text
                                                    type="secondary"
                                                    strong
                                                    style={{ fontSize: 'var(--fs-rel-lg)' }}
                                                >
                                                    §{p.paragraphIndex}
                                                </Text>{' '}
                                                <Text
                                                    type="secondary"
                                                    style={{ fontSize: 'var(--fs-rel-xl)' }}
                                                >
                                                    {p.snippet.replace(/\n/g, ' ')}
                                                </Text>
                                            </div>
                                        ))}
                                    </List.Item>
                                );
                            }}
                        />
                    </div>

                    {allHits.length > PAGE_SIZE && (
                        <div style={{ textAlign: 'center', marginTop: 12 }}>
                            <Pagination
                                current={page}
                                pageSize={PAGE_SIZE}
                                total={allHits.length}
                                showSizeChanger={false}
                                onChange={(page) => {
                                    setPage(page);
                                    if (listElRef.current) {
                                        listElRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                                    }
                                }}
                            />
                        </div>
                    )}
                </>
            )}
        </Modal>
    );
}
