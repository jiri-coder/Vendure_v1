import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
    locales: ['cs'],
    defaultLocale: 'cs',
});

export type Locale = (typeof routing.locales)[number];

export const localeNames: Record<Locale, string> = {
    cs: 'Čeština',
};
