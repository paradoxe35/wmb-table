import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import es from './locales/es';

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        es: { translation: es },
    },
    lng: 'fr',
    fallbackLng: 'fr',
    interpolation: {
        escapeValue: false,
    },
    parseMissingKeyHandler: (key: string) => key,
});

export default i18n;
