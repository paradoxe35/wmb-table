import { Button, Modal, Space } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useModalVisible } from '@renderer/hooks';
import { Avatar } from 'antd';
import { APP_NAME, DOCS_LINK, DOCS_SUBJECT_LINK, DOCS_NOTE_LINK } from '@renderer/utils/constants';
import { Typography } from 'antd';
import { useSermonStore } from '@renderer/stores';

const { Title, Paragraph, Link } = Typography;

export default function Welcome() {
    const { visible, show, hide } = useModalVisible();

    const [image, setImage] = useState<undefined | string>(undefined);

    useEffect(() => {
        window.api.app.getUpdateStatus().then((status) => {
            if (status.type === 'none') {
                show();
            }
        });
        window.api.app.getAsset('icon.png').then((path) => setImage(path));
    }, []);

    const goToBackupModal = useCallback(() => {
        hide();
        window.dispatchEvent(new Event('open-backup-modal-from-main'));
    }, []);

    return (
        <>
            <Modal
                centered
                width="60%"
                title={
                    <>
                        <Space orientation="horizontal">
                            <Avatar size="large" src={image} />
                            <span>{APP_NAME}</span>
                        </Space>
                    </>
                }
                open={visible}
                footer={[
                    <Button key={0} onClick={hide}>
                        Commencer
                    </Button>,
                    <Button key={1} type="dashed" onClick={goToBackupModal}>
                        Restaurer vos donn\u00e9es
                    </Button>,
                    <Button key={2} type="primary">
                        <Link
                            style={{ color: '#fff', textDecoration: 'none' }}
                            target="_blank"
                            href={DOCS_LINK}
                        >
                            Documentation
                        </Link>
                    </Button>,
                ]}
                onOk={hide}
                onCancel={hide}
            >
                <WelcomeContent />
            </Modal>
        </>
    );
}

const WelcomeContent = () => {
    const sermons = useSermonStore((s) => s.sermons);

    return (
        <Typography>
            <Title>Bienvenue \u00e0 {APP_NAME}</Title>
            <Paragraph>Voici quelques fonctionnalit\u00e9s prises en charge: </Paragraph>
            <Paragraph>
                <ul>
                    <li>
                        {sermons.length} sermons d\u00e9j\u00e0 enregistr\u00e9s et regroup\u00e9s
                        par an.
                    </li>
                    <li>
                        Recherchez des mots ou des phrases dans tous les documents avec des
                        r\u00e9sultats pertinents.
                    </li>
                    <li>Ajouter de nouveaux documents.</li>
                    <li>
                        Regroupez vos r\u00e9f\u00e9rences de documents par sujet(pour plus
                        d&apos;infos, allez dans la{' '}
                        <Link target="_blank" href={DOCS_SUBJECT_LINK}>
                            documentation
                        </Link>
                        ).
                    </li>
                    <li>Cr\u00e9er des notes et les modifier.</li>
                    <li>
                        Ajoutez des r\u00e9f\u00e9rences de documents ou de la Bible dans vos notes(
                        <Link target="_blank" href={DOCS_NOTE_LINK}>
                            documentation
                        </Link>
                        ).
                    </li>
                    <li>Bible (Louis Segond)</li>
                    <li>
                        Sauvegarde automatique de vos param\u00e8tres et donn\u00e9es sur Internet
                        pour les restaurer ult\u00e9rieurement.
                    </li>
                    <li>Etc.</li>
                </ul>
            </Paragraph>
        </Typography>
    );
};
