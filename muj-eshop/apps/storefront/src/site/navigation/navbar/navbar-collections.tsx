import {getRouteLocale} from '@/platform/i18n/server';
import {cacheLife, cacheTag} from 'next/cache';
import {getTopCollections} from '@/features/collections/data';
import {CatalogMenu} from '@/site/navigation/navbar/catalog-menu';

export async function NavbarCollections() {
    'use cache';
    cacheLife('days');

    const locale = await getRouteLocale();
    cacheTag(`navbar-collections-${locale}`);

    const collections = await getTopCollections(locale);

    return <CatalogMenu collections={collections} />;
}
