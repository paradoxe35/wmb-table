import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@shared/i18n/locales/en';
import es from '@shared/i18n/locales/es';
import { DEFAULT_UI_LANGUAGE } from '@shared/constants';

// French keys ARE the French strings — map each key to itself so i18next
// finds the translation and applies interpolation (e.g. {{rate}}, {{count}}).
const fr = Object.fromEntries(Object.keys(en).map((k) => [k, k]));

i18n.use(initReactI18next).init({
    resources: {
        fr: { translation: fr },
        en: { translation: en },
        es: { translation: es },
    },
    lng: DEFAULT_UI_LANGUAGE,
    fallbackLng: DEFAULT_UI_LANGUAGE,
    interpolation: {
        escapeValue: false,
    },
    parseMissingKeyHandler: (key: string) => key,
});

export default i18n;
