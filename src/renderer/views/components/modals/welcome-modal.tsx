import { useCallback, useEffect, useState } from 'react';
import { Button, Modal, Typography } from 'antd';
import {
    BookOutlined,
    FileSearchOutlined,
    FormOutlined,
    HighlightOutlined,
    RobotOutlined,
    SoundOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@renderer/stores';
import appIcon from '@renderer/assets/app-icon.png';

const { Title, Text } = Typography;

interface FeatureItemProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

function FeatureItem({ icon, title, description }: FeatureItemProps) {
    return (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
                style={{
                    fontSize: 20,
                    color: 'var(--ant-color-primary)',
                    flexShrink: 0,
                    marginTop: 2,
                }}
            >
                {icon}
            </div>
            <div>
                <Text strong style={{ display: 'block', marginBottom: 2 }}>
                    {title}
                </Text>
                <Text type="secondary" style={{ fontSize: '0.88em' }}>
                    {description}
                </Text>
            </div>
        </div>
    );
}

export default function WelcomeModal() {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    const activeLanguage = useAppStore((s) => s.activeLanguage);

    useEffect(() => {
        if (!activeLanguage) return;

        window.api.app.isInitialized().then((initialized) => {
            if (!initialized) setVisible(true);
        });
    }, [activeLanguage]);

    const handleClose = useCallback(() => {
        setVisible(false);
        window.api.app.initialize();
    }, []);

    return (
        <Modal
            open={visible}
            onCancel={handleClose}
            footer={
                <Button type="primary" size="large" onClick={handleClose} block>
                    {t('Commencer')}
                </Button>
            }
            width={520}
            centered
            closable={false}
        >
            <div style={{ textAlign: 'center', marginBottom: 20, paddingTop: 8 }}>
                <img
                    src={appIcon}
                    alt="Wmb Table"
                    style={{ width: 64, height: 64, marginBottom: 12 }}
                />
                <Title level={3} style={{ margin: 0 }}>
                    {t('Bienvenue dans Wmb Table')}
                </Title>
                <Text type="secondary">
                    {t('Votre espace pour lire, étudier et préparer vos prédications.')}
                </Text>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <FeatureItem
                    icon={<BookOutlined />}
                    title={t('Prédications et Bible')}
                    description={t(
                        'Ouvrez les prédications et la Bible dans des onglets, naviguez par paragraphe.',
                    )}
                />
                <FeatureItem
                    icon={<FormOutlined />}
                    title={t('Notes et sujets')}
                    description={t(
                        'Prenez des notes, classez vos passages par sujets avec des références.',
                    )}
                />
                <FeatureItem
                    icon={<FileSearchOutlined />}
                    title={t('Recherche complète')}
                    description={t(
                        'Recherchez dans le contenu des prédications, la Bible et vos documents.',
                    )}
                />
                <FeatureItem
                    icon={<HighlightOutlined />}
                    title={t('Surlignage')}
                    description={t(
                        'Surlignez les passages importants avec des couleurs et retrouvez-les facilement.',
                    )}
                />
                <FeatureItem
                    icon={<SoundOutlined />}
                    title={t('Lecture audio')}
                    description={t('Écoutez les prédications avec plusieurs voix disponibles.')}
                />
                <FeatureItem
                    icon={<RobotOutlined />}
                    title={t('Assistant IA')}
                    description={t(
                        'Posez des questions et obtenez des réponses avec des références cliquables.',
                    )}
                />
            </div>
        </Modal>
    );
}
