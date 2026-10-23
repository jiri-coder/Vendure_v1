import {cacheLife, cacheTag} from 'next/cache';
import {query} from '@/platform/vendure/api';
import {GetTopCollectionsQuery} from './graphql';

export interface CatalogCollection {
    id: string;
    name: string;
    slug: string;
    position: number;
    featuredAsset?: {preview: string} | null;
    children: CatalogCollection[];
}

function sortCatalog(items: CatalogCollection[]): CatalogCollection[] {
    return [...items]
        .sort((left, right) => left.position - right.position)
        .map(item => ({
            ...item,
            featuredAsset: item.featuredAsset ?? null,
            children: sortCatalog(item.children ?? []),
        }));
}

export async function getTopCollections(locale: string) {
    'use cache';
    cacheLife('days');
    cacheTag(`collections-${locale}-image`);

    const result = await query(GetTopCollectionsQuery, undefined, {languageCode: locale});
    return sortCatalog(result.data.collections.items as CatalogCollection[]);
}
