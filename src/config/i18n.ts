import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from '../locales/en.json';
import itTranslations from '../locales/it.json';
import enExt from '../locales/en-ext.json';
import itExt from '../locales/it-ext.json';
import { mergeTranslations } from '../utils/mergeTranslations';

const enMerged = mergeTranslations(enTranslations, enExt) as typeof enTranslations;
const itMerged = mergeTranslations(itTranslations, itExt) as typeof itTranslations;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enMerged,
      },
      it: {
        translation: itMerged,
      },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'it'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => lng.split('-')[0],
    },
  });

export default i18n;
