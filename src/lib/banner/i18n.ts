import translations from './translations.json';

export type Language = 'en' | 'tl';

let currentLanguage: Language = 'en';

export function setLanguage(lang: Language): void {
  currentLanguage = lang;
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function t(path: string, lang?: Language): string {
  const language = lang || currentLanguage;
  const keys = path.split('.');
  let result: any = translations;
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      // Fallback to English if translation not found
      let fallback: any = translations.en;
      for (const fk of keys) {
        if (fallback && typeof fallback === 'object' && fk in fallback) {
          fallback = fallback[fk];
        } else {
          return path; // Return path as last resort
        }
      }
      return typeof fallback === 'string' ? fallback : path;
    }
  }
  return typeof result === 'string' ? result : path;
}