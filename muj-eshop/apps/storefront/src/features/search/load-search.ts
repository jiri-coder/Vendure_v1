import {query} from '@/platform/vendure/api';
import {SearchProductsQuery} from '@/features/search/graphql';
import {buildSearchInput} from '@/features/search/search-helpers';

export async function loadProductSearch(options: {
    searchParams: { [key: string]: string | string[] | undefined };
    collectionSlug?: string;
    languageCode: string;
    currencyCode: string;
}) {
    const boundsInput = buildSearchInput({
        searchParams: options.searchParams,
        collectionSlug: options.collectionSlug,
    });
    const bounds = await query(SearchProductsQuery, {
        input: { ...boundsInput, take: 0, skip: 0 },
    }, {languageCode: options.languageCode, currencyCode: options.currencyCode});

    const products = await query(SearchProductsQuery, {
        input: buildSearchInput({
            searchParams: options.searchParams,
            collectionSlug: options.collectionSlug,
            dimensionFacetValues: bounds.data.search.facetValues,
        }),
    }, {languageCode: options.languageCode, currencyCode: options.currencyCode});

    return {
        ...products,
        dimensionFacetValues: bounds.data.search.facetValues,
    };
}
