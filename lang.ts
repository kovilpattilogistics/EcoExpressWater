import { Language } from './constants/translations';

export const COOKIE_NAME = 'eco_lang';
export const STORAGE_KEY = 'eco_lang';

export function getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

export function setCookie(name: string, value: string, days: number = 365) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${d.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax;Secure`;
}

export function getEcoLang(): Language {
    // 1. Query Param
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const paramLang = params.get('lang');
        if (paramLang === 'en' || paramLang === 'ta') {
            return paramLang as Language;
        }
    }

    // 2. Local Storage
    if (typeof localStorage !== 'undefined') {
        const localLang = localStorage.getItem(STORAGE_KEY);
        if (localLang === 'en' || localLang === 'ta') {
            return localLang as Language;
        }
    }

    // 3. Cookie
    if (typeof document !== 'undefined') {
        const cookieLang = getCookie(COOKIE_NAME);
        if (cookieLang === 'en' || cookieLang === 'ta') {
            return cookieLang as Language;
        }
    }

    // 4. Default
    return 'en';
}

export function setEcoLang(lang: Language) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, lang);
    }
    if (typeof document !== 'undefined') {
        setCookie(COOKIE_NAME, lang);
    }
}
