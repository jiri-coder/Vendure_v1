import type { ResultOf } from 'gql.tada';
import type {GetProductDetailQuery} from './graphql';

type ProductDetail = NonNullable<ResultOf<typeof GetProductDetailQuery>['product']>;

/**
 * Vendure 3.6 made ProductOptionGroup/ProductOption shared and channel-aware
 * (vendure#4469): a product's `optionGroups` now returns every option in the
 * (possibly shared) group, including options for which this product has no
 * variant. Rendering those directly produces "phantom" option buttons with no
 * price, no stock status, and a permanently disabled add-to-cart.
 *
 * This returns the option groups reduced to the options actually used by one of
 * the product's variants, dropping any group left with no options.
 */
export function getDisplayOptionGroups(product: ProductDetail): ProductDetail['optionGroups'] {
    const usedOptionIds = new Set(
        product.variants.flatMap((variant) => variant.options.map((option) => option.id)),
    );

    return product.optionGroups
        .map((group) => ({
            ...group,
            options: group.options.filter((option) => usedOptionIds.has(option.id)),
        }))
        .filter((group) => group.options.length > 0);
}

export function selectedOptionsFromSearchParams(
    product: ProductDetail,
    searchParams: { [key: string]: string | string[] | undefined },
): Record<string, string> {
    const selectedOptions: Record<string, string> = {};

    for (const group of product.optionGroups) {
        const paramValue = searchParams[group.code];
        if (typeof paramValue !== 'string') {
            continue;
        }
        const option = group.options.find(item => item.code === paramValue);
        if (option) {
            selectedOptions[group.id] = option.id;
        }
    }

    return selectedOptions;
}

export function getSelectedVariant(
    product: ProductDetail,
    selectedOptions: Record<string, string>,
): ProductDetail['variants'][number] | undefined {
    if (product.variants.length === 1) {
        return product.variants[0];
    }

    if (Object.keys(selectedOptions).length !== product.optionGroups.length) {
        return undefined;
    }

    return product.variants.find(variant => {
        const variantOptionIds = variant.options.map(option => option.id);
        return Object.values(selectedOptions).every(optionId => variantOptionIds.includes(optionId));
    });
}
