import { Button, Card, Flex, Typography } from 'antd';
import { BookOutlined, CommentOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@renderer/stores';
import { SETTINGS_TAB_KEYS } from '@renderer/stores/app.store';
import { buildDocsGuideLink } from '@renderer/utils/constants';

const { Title, Paragraph } = Typography;

export default function AssistantSetupCard() {
    const { t } = useTranslation();
    const openSettingsTab = useAppStore((s) => s.openSettingsTab);
    const contentLanguage = useAppStore((s) => s.contentLanguage);

    function openGuide() {
        void window.api.app.openExternal(buildDocsGuideLink('settings-assistant', contentLanguage));
    }

    return (
        <div className="ai-chat__setup">
            <Card className="ai-chat__setup-card" data-testid="ai-setup-card">
                <Flex vertical align="center" gap={4}>
                    <CommentOutlined className="ai-chat__setup-icon" aria-hidden />
                    <Title level={3} className="ai-chat__setup-title">
                        {t('Assistant IA')}
                    </Title>
                </Flex>
                <Paragraph>
                    {t(
                        "Posez une question sur un sujet d'étude : l'assistant développe le thème, rapproche ce que disent les prédications et les Écritures, et vous donne les références pour vérifier par vous-même.",
                    )}
                </Paragraph>
                <Paragraph type="secondary">
                    {t(
                        "Pour l'utiliser, choisissez un service d'IA — par exemple OpenAI, Claude, Gemini, OpenRouter, ou Ollama sur votre ordinateur — et ajoutez votre clé API si le service en demande une.",
                    )}
                </Paragraph>
                <Flex vertical align="center" gap={8}>
                    <Button
                        type="primary"
                        size="large"
                        icon={<SettingOutlined />}
                        onClick={() => openSettingsTab(SETTINGS_TAB_KEYS.ai)}
                    >
                        {t("Configurer l'assistant")}
                    </Button>
                    <Button type="link" icon={<BookOutlined />} onClick={openGuide}>
                        {t('Voir le guide')}
                    </Button>
                </Flex>
            </Card>
        </div>
    );
}
