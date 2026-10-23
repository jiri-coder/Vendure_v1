'use client';

import {useLocale} from 'next-intl';
import {toIntlLocale} from '@/platform/i18n/locale-utils';

interface PriceProps {
    value: number;
    currencyCode?: string;
}

export function Price({value, currencyCode = 'USD'}: PriceProps) {
    const locale = useLocale();
    const intlLocale = toIntlLocale(locale);
    const useWholeCrowns = currencyCode === 'CZK';
    return (
        <>
            {new Intl.NumberFormat(intlLocale, {
                style: 'currency',
                currency: currencyCode,
                ...(useWholeCrowns && {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                }),
            }).format(value / 100)}
        </>
    );
}
