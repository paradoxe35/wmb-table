import { defineConfig } from 'vitepress';

const frNav = [
    { text: 'Accueil', link: '/' },
    { text: 'Documentation', link: '/guide/interface-overview' },
    { text: 'Contact', link: '/contact' },
];

const enNav = [
    { text: 'Home', link: '/en/' },
    { text: 'Documentation', link: '/en/guide/interface-overview' },
    { text: 'Contact', link: '/en/contact' },
];

const esNav = [
    { text: 'Inicio', link: '/es/' },
    { text: 'Documentación', link: '/es/guide/interface-overview' },
    { text: 'Contacto', link: '/es/contact' },
];

const frSidebar = [
    {
        text: 'Commencer',
        items: [
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Commencer', link: '/guide/getting-started' },
            { text: "Comprendre l'interface", link: '/guide/interface-overview' },
        ],
    },
    {
        text: 'Lecture',
        items: [
            { text: 'Lire les prédications', link: '/guide/sermons' },
            { text: 'Utiliser la vue de lecture', link: '/guide/document-view' },
            { text: 'Faire une recherche', link: '/guide/search' },
            { text: 'Utiliser la Bible', link: '/guide/bible' },
        ],
    },
    {
        text: 'Préparer votre message',
        items: [
            { text: 'Prendre des notes', link: '/guide/notes' },
            { text: 'Créer des sujets', link: '/guide/subjects' },
            { text: 'Gérer vos soulignages', link: '/guide/highlights' },
            { text: 'Ajouter vos documents PDF', link: '/guide/custom-documents' },
            { text: 'Voir votre historique', link: '/guide/history' },
        ],
    },
    {
        text: 'Paramètres',
        items: [
            { text: 'Vue d’ensemble des paramètres', link: '/guide/settings-overview' },
            { text: 'Général', link: '/guide/settings-general' },
            { text: 'Vue document', link: '/guide/settings-document-view' },
            { text: 'Langues', link: '/guide/languages' },
            { text: 'Assistant', link: '/guide/settings-assistant' },
            { text: 'Lecture audio et voix', link: '/guide/audio-and-tts' },
            { text: 'Sauvegarde et synchronisation', link: '/guide/backup-and-sync' },
            { text: 'Mises à jour', link: '/guide/updates' },
        ],
    },
    {
        text: 'Aide',
        items: [
            { text: 'Discussion IA', link: '/guide/ai-chat' },
            { text: 'Questions et dépannage', link: '/guide/troubleshooting' },
            { text: 'Nous contacter', link: '/contact' },
        ],
    },
];

const enSidebar = [
    {
        text: 'Start Here',
        items: [
            { text: 'Installation', link: '/en/guide/installation' },
            { text: 'Getting Started', link: '/en/guide/getting-started' },
            { text: 'Understanding the Interface', link: '/en/guide/interface-overview' },
        ],
    },
    {
        text: 'Reading',
        items: [
            { text: 'Reading Sermons', link: '/en/guide/sermons' },
            { text: 'Using the Reading View', link: '/en/guide/document-view' },
            { text: 'Searching', link: '/en/guide/search' },
            { text: 'Using the Bible', link: '/en/guide/bible' },
        ],
    },
    {
        text: 'Prepare Your Message',
        items: [
            { text: 'Taking Notes', link: '/en/guide/notes' },
            { text: 'Creating Subjects', link: '/en/guide/subjects' },
            { text: 'Managing Your Highlights', link: '/en/guide/highlights' },
            { text: 'Adding PDF Documents', link: '/en/guide/custom-documents' },
            { text: 'Viewing History', link: '/en/guide/history' },
        ],
    },
    {
        text: 'Settings',
        items: [
            { text: 'Settings Overview', link: '/en/guide/settings-overview' },
            { text: 'General', link: '/en/guide/settings-general' },
            { text: 'Document View', link: '/en/guide/settings-document-view' },
            { text: 'Languages', link: '/en/guide/languages' },
            { text: 'Assistant', link: '/en/guide/settings-assistant' },
            { text: 'Audio Reading and Voices', link: '/en/guide/audio-and-tts' },
            { text: 'Backup and Sync', link: '/en/guide/backup-and-sync' },
            { text: 'Updates', link: '/en/guide/updates' },
        ],
    },
    {
        text: 'Help',
        items: [
            { text: 'AI Chat', link: '/en/guide/ai-chat' },
            { text: 'Questions and Troubleshooting', link: '/en/guide/troubleshooting' },
            { text: 'Contact Us', link: '/en/contact' },
        ],
    },
];

const esSidebar = [
    {
        text: 'Empezar',
        items: [
            { text: 'Instalación', link: '/es/guide/installation' },
            { text: 'Primeros pasos', link: '/es/guide/getting-started' },
            { text: 'Entender la interfaz', link: '/es/guide/interface-overview' },
        ],
    },
    {
        text: 'Lectura',
        items: [
            { text: 'Leer predicaciones', link: '/es/guide/sermons' },
            { text: 'Usar la vista de lectura', link: '/es/guide/document-view' },
            { text: 'Buscar', link: '/es/guide/search' },
            { text: 'Usar la Biblia', link: '/es/guide/bible' },
        ],
    },
    {
        text: 'Preparar su mensaje',
        items: [
            { text: 'Tomar notas', link: '/es/guide/notes' },
            { text: 'Crear temas', link: '/es/guide/subjects' },
            { text: 'Gestionar sus subrayados', link: '/es/guide/highlights' },
            { text: 'Agregar documentos PDF', link: '/es/guide/custom-documents' },
            { text: 'Ver historial', link: '/es/guide/history' },
        ],
    },
    {
        text: 'Ajustes',
        items: [
            { text: 'Vista general de ajustes', link: '/es/guide/settings-overview' },
            { text: 'General', link: '/es/guide/settings-general' },
            { text: 'Vista de lectura', link: '/es/guide/settings-document-view' },
            { text: 'Idiomas', link: '/es/guide/languages' },
            { text: 'Assistant', link: '/es/guide/settings-assistant' },
            { text: 'Lectura en audio y voces', link: '/es/guide/audio-and-tts' },
            { text: 'Copia de seguridad y sincronización', link: '/es/guide/backup-and-sync' },
            { text: 'Actualizaciones', link: '/es/guide/updates' },
        ],
    },
    {
        text: 'Ayuda',
        items: [
            { text: 'Chat con IA', link: '/es/guide/ai-chat' },
            { text: 'Preguntas y solución de problemas', link: '/es/guide/troubleshooting' },
            { text: 'Contáctenos', link: '/es/contact' },
        ],
    },
];

export default defineConfig({
    title: 'Wmb Table',
    description: 'Lecture, Bible, notes et organisation des prédications.',
    cleanUrls: true,
    head: [
        ['link', { rel: 'icon', href: '/icon.png' }],
        ['meta', { name: 'theme-color', content: '#1990ff' }],
        [
            'meta',
            {
                name: 'google-site-verification',
                content: 'gn50R9DrNOEkbsv3UySO1OPIdR5WXxXPtNdyCF6Ln38',
            },
        ],
    ],
    themeConfig: {
        logo: '/icon.png',
        search: {
            provider: 'local',
        },
    },
    locales: {
        root: {
            label: 'Français',
            lang: 'fr-FR',
            title: 'Wmb Table',
            description: 'Lecture, Bible, notes et organisation des prédications.',
            themeConfig: {
                nav: frNav,
                sidebar: frSidebar,
                outline: {
                    label: 'Sur cette page',
                },
                docFooter: {
                    prev: 'Page précédente',
                    next: 'Page suivante',
                },
                returnToTopLabel: 'Retour en haut',
                sidebarMenuLabel: 'Menu',
                darkModeSwitchLabel: 'Apparence',
                lightModeSwitchTitle: 'Passer en mode clair',
                darkModeSwitchTitle: 'Passer en mode sombre',
                langMenuLabel: 'Langues',
            },
        },
        en: {
            label: 'English',
            lang: 'en-US',
            link: '/en/',
            title: 'Wmb Table',
            description: 'Reading, Bible, notes, and sermon organization.',
            themeConfig: {
                nav: enNav,
                sidebar: enSidebar,
            },
        },
        es: {
            label: 'Español',
            lang: 'es-ES',
            link: '/es/',
            title: 'Wmb Table',
            description: 'Lectura, Biblia, notas y organización de predicaciones.',
            themeConfig: {
                nav: esNav,
                sidebar: esSidebar,
            },
        },
    },
});
