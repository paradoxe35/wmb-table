import { defineConfig } from 'vitepress';

const frNav = [
    { text: 'Accueil', link: '/' },
    { text: 'Commencer', link: '/guide/getting-started' },
    { text: 'Guides', link: '/guide/interface-overview' },
];

const enNav = [
    { text: 'Home', link: '/en/' },
    { text: 'Start Here', link: '/en/guide/getting-started' },
    { text: 'Guides', link: '/en/guide/interface-overview' },
];

const esNav = [
    { text: 'Inicio', link: '/es/' },
    { text: 'Empezar', link: '/es/guide/getting-started' },
    { text: 'Guías', link: '/es/guide/interface-overview' },
];

const frSidebar = [
    {
        text: 'Découvrir',
        items: [
            { text: 'Commencer', link: '/guide/getting-started' },
            { text: "Comprendre l'interface", link: '/guide/interface-overview' },
        ],
    },
    {
        text: 'Lire et retrouver',
        items: [
            { text: 'Lire les prédications', link: '/guide/sermons' },
            { text: 'Faire une recherche', link: '/guide/search' },
            { text: 'Utiliser la Bible', link: '/guide/bible' },
        ],
    },
    {
        text: 'Organiser votre travail',
        items: [
            { text: 'Prendre des notes', link: '/guide/notes' },
            { text: 'Créer des sujets', link: '/guide/subjects' },
            { text: 'Ajouter vos documents PDF', link: '/guide/custom-documents' },
            { text: 'Voir votre historique', link: '/guide/history' },
        ],
    },
    {
        text: 'Réglages et services',
        items: [
            { text: 'Langues', link: '/guide/languages' },
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
        ],
    },
];

const enSidebar = [
    {
        text: 'Discover',
        items: [
            { text: 'Getting Started', link: '/en/guide/getting-started' },
            { text: 'Understanding the Interface', link: '/en/guide/interface-overview' },
        ],
    },
    {
        text: 'Read and Find',
        items: [
            { text: 'Reading Sermons', link: '/en/guide/sermons' },
            { text: 'Searching', link: '/en/guide/search' },
            { text: 'Using the Bible', link: '/en/guide/bible' },
        ],
    },
    {
        text: 'Organize Your Work',
        items: [
            { text: 'Taking Notes', link: '/en/guide/notes' },
            { text: 'Creating Subjects', link: '/en/guide/subjects' },
            { text: 'Adding PDF Documents', link: '/en/guide/custom-documents' },
            { text: 'Viewing History', link: '/en/guide/history' },
        ],
    },
    {
        text: 'Settings and Services',
        items: [
            { text: 'Languages', link: '/en/guide/languages' },
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
        ],
    },
];

const esSidebar = [
    {
        text: 'Descubrir',
        items: [
            { text: 'Primeros pasos', link: '/es/guide/getting-started' },
            { text: 'Entender la interfaz', link: '/es/guide/interface-overview' },
        ],
    },
    {
        text: 'Leer y encontrar',
        items: [
            { text: 'Leer predicaciones', link: '/es/guide/sermons' },
            { text: 'Buscar', link: '/es/guide/search' },
            { text: 'Usar la Biblia', link: '/es/guide/bible' },
        ],
    },
    {
        text: 'Organizar su trabajo',
        items: [
            { text: 'Tomar notas', link: '/es/guide/notes' },
            { text: 'Crear temas', link: '/es/guide/subjects' },
            { text: 'Agregar documentos PDF', link: '/es/guide/custom-documents' },
            { text: 'Ver historial', link: '/es/guide/history' },
        ],
    },
    {
        text: 'Ajustes y servicios',
        items: [
            { text: 'Idiomas', link: '/es/guide/languages' },
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
    ],
    themeConfig: {
        logo: '/icon.png',
        search: {
            provider: 'local',
        },
        socialLinks: [{ icon: 'github', link: 'https://github.com/paradoxe35/wmb-table' }],
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
