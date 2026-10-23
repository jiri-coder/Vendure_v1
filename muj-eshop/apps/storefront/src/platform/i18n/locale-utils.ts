import type {Locale} from './routing';

const OG_LOCALE_MAP: Record<Locale, string> = { cs: 'cs_CZ' };
const INTL_LOCALE_MAP: Record<Locale, string> = { cs: 'cs-CZ' };

export function toOgLocale(locale: string): string {
    return OG_LOCALE_MAP[locale as Locale] || 'cs_CZ';
}

export function toIntlLocale(locale: string): string {
    return INTL_LOCALE_MAP[locale as Locale] || 'cs-CZ';
}
