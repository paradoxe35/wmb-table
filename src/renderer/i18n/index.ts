import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@shared/i18n/locales/en';
import es from '@shared/i18n/locales/es';
import fr from '@shared/i18n/locales/fr';
import pt from '@shared/i18n/locales/pt';
import sw from '@shared/i18n/locales/sw';
import { resolveUiLanguage } from '@shared/constants';

const initialLanguage = resolveUiLanguage(null, null);

i18n.use(initReactI18next).init({
    resources: {
        fr: { translation: fr },
        en: { translation: en },
        es: { translation: es },
        pt: { translation: pt },
        sw: { translation: sw },
    },
    lng: initialLanguage,
    fallbackLng: initialLanguage,
    interpolation: {
        escapeValue: false,
    },
    parseMissingKeyHandler: (key: string) => key,
});

export default i18n;
