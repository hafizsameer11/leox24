import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLanguageCode } from '../utils/i18n';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage = normalizeLanguageCode(i18n.language);
  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  ];

  const changeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setIsOpen(false);
  };

  const currentLang = languages.find((lang) => lang.code === currentLanguage) || languages[0];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="relative">
        {/* Language Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 rounded-full bg-aqua-5 hover:bg-aqua-6 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center text-2xl focus:outline-none focus:ring-2 focus:ring-aqua-5 focus:ring-offset-2"
          aria-label={t('language.switchLanguage')}
        >
          {currentLang.flag}
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Menu */}
            <div className="absolute bottom-16 right-0 bg-white rounded-xl shadow-2xl border border-line overflow-hidden min-w-[160px] z-50">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                    currentLanguage === lang.code
                      ? 'bg-aqua-5/10 text-aqua-7 font-medium'
                      : 'text-ink'
                  }`}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <span className="text-sm">{lang.name}</span>
                  {currentLanguage === lang.code && (
                    <span className="ml-auto text-aqua-5">✓</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
