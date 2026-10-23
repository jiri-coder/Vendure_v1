import {getRouteLocale} from '@/platform/i18n/server';
import {getTranslations} from 'next-intl/server';

interface SearchTermProps {
    searchParams: Promise<{
        q?: string;
        brand?: string;
        series?: string;
    }>;
}

function singleValue(value: string | string[] | undefined): string {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw?.trim() ?? '';
}

export async function SearchTerm({searchParams}: SearchTermProps) {
    const searchParamsResolved = await searchParams;
    const searchTerm = singleValue(searchParamsResolved.q);
    const brand = singleValue(searchParamsResolved.brand);
    const series = singleValue(searchParamsResolved.series);
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Search'});
    const title = brand && series
        ? t('brandSeriesTitle', {brand, series})
        : brand
            ? t('brandTitle', {name: brand})
            : series
                ? t('seriesTitle', {name: series})
                : searchTerm
                    ? t('resultsFor', {query: searchTerm})
                    : t('title');

    return (
        <div className="mb-6">
            <h1 className="text-3xl font-bold">
                {title}
            </h1>
        </div>
    )
}

export function SearchTermSkeleton() {
    return (
        <div className="mb-6">
            <div className="h-9 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
    )
}
