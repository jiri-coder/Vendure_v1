'use server';

import {getLocale} from 'next-intl/server';
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import type {AccessoryProduct} from '@/features/products/components/accessory-offer';
import {GetProductAccessoriesQuery} from '@/features/products/graphql';
import {query} from '@/platform/vendure/api';

export async function loadProductAccessories(slug: string, currentProductId: string): Promise<AccessoryProduct[]> {
    const locale = await getLocale();
    const currencyCode = await getActiveCurrencyCode();
    const result = await query(
        GetProductAccessoriesQuery,
        {slug},
        {languageCode: locale, currencyCode, fetch: {cache: 'no-store'}},
    );

    return (result.data.product?.customFields?.relatedProducts ?? []).flatMap(item => {
        if (!item.enabled || item.id === currentProductId || item.variants.length === 0) {
            return [];
        }
        return [{
            id: item.id,
            name: item.name,
            slug: item.slug,
            featuredAsset: item.featuredAsset,
            availability: item.customFields?.availability,
            variants: item.variants.map(variant => ({
                id: variant.id,
                priceWithTax: variant.priceWithTax,
                currencyCode: variant.currencyCode,
                stockLevel: variant.stockLevel,
            })),
        }];
    });
}
