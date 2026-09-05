export type AppLanguage = 'en' | 'it';

/** Normalize i18next language codes (e.g. it-IT → it). */
export function normalizeLanguageCode(language?: string): AppLanguage {
  const code = (language || 'en').split('-')[0].toLowerCase();
  return code === 'it' ? 'it' : 'en';
}
