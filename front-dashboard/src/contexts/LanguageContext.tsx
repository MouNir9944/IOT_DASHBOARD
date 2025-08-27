'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Import language files
import enTranslations from '../locales/en.json';
import frTranslations from '../locales/fr.json';

type Language = 'en' | 'fr';

interface LanguageContextType {
  currentLanguage: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  tWithParams: (key: string, params: Record<string, string | number>) => string;
}

const translations = {
  en: enTranslations,
  fr: frTranslations,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');

  // Initialize language from localStorage or browser preference
  useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'fr')) {
      setCurrentLanguage(savedLang);
    } else {
      // Detect browser language
      const browserLang = navigator.language || navigator.languages?.[0] || 'en';
      const detectedLang: Language = browserLang.toLowerCase().startsWith('fr') ? 'fr' : 'en';
      setCurrentLanguage(detectedLang);
      localStorage.setItem('preferred-language', detectedLang);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setCurrentLanguage(lang);
    localStorage.setItem('preferred-language', lang);
    console.log(`🌐 Language changed to: ${lang}`);
  };

  // Translation function
  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[currentLanguage];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if translation not found
        value = keys.reduce((obj, k) => obj?.[k], translations.en);
        break;
      }
    }
    
    return typeof value === 'string' ? value : key;
  };

  // Translation function with parameters
  const tWithParams = (key: string, params: Record<string, string | number>): string => {
    let translation = t(key);
    
    Object.entries(params).forEach(([param, value]) => {
      translation = translation.replace(new RegExp(`{${param}}`, 'g'), String(value));
    });
    
    return translation;
  };

  const value: LanguageContextType = {
    currentLanguage,
    setLanguage,
    t,
    tWithParams,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Export the context for direct usage if needed
export { LanguageContext };
