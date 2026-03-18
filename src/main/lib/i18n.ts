import i18next, { type i18n as I18n } from 'i18next';
import en from '@shared/i18n/locales/en';
import es from '@shared/i18n/locales/es';
import { DEFAULT_UI_LANGUAGE } from '@shared/constants';

const fr = Object.fromEntries(Object.keys(en).map((k) => [k, k]));

const i18n: I18n = i18next.createInstance();

i18n.init({
    resources: {
        fr: { translation: fr },
        en: { translation: en },
        es: { translation: es },
    },
    lng: DEFAULT_UI_LANGUAGE,
    fallbackLng: DEFAULT_UI_LANGUAGE,
    interpolation: { escapeValue: false },
    parseMissingKeyHandler: (key: string) => key,
});

export default i18n;
