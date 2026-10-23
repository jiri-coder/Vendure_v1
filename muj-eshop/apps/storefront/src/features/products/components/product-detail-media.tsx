'use client';

import {useCallback, useState} from 'react';
import {ProductImageCarousel} from '@/features/products/components/product-image-carousel';
import {ProductVideos} from '@/features/products/components/product-videos';
import {ProductInfo} from '@/features/products/components/product-info';
import {galleryImagesForVariant} from '@/features/products/product-gallery';
import {
    getSelectedVariant,
    selectedOptionsFromSearchParams,
} from '@/features/products/product-options';
import type {ResultOf} from '@/platform/vendure/graphql';
import type {GetProductDetailQuery} from '@/features/products/graphql';

type ProductDetail = NonNullable<ResultOf<typeof GetProductDetailQuery>['product']>;
type ProductVariant = ProductDetail['variants'][number];

interface AdvancePaymentOffer {
    percentageRate: number;
    fixedFee: number;
}

interface ProductDetailMediaProps {
    product: ProductDetail;
    searchParams: {[key: string]: string | string[] | undefined};
    currencyCode: string;
    advancePayment: AdvancePaymentOffer | null;
    videosTitle: string;
}

export function ProductDetailMedia({
    product,
    searchParams,
    currencyCode,
    advancePayment,
    videosTitle,
}: ProductDetailMediaProps) {
    const initialVariant = getSelectedVariant(
        product,
        selectedOptionsFromSearchParams(product, searchParams),
    );
    const [galleryVariantId, setGalleryVariantId] = useState(initialVariant?.id);
    const galleryVariant =
        product.variants.find(variant => variant.id === galleryVariantId) ?? initialVariant;
    const productAssets = [
        ...(product.featuredAsset ? [product.featuredAsset] : []),
        ...product.assets,
    ];
    const images = galleryImagesForVariant(productAssets, galleryVariant);

    const handleSelectedVariantChange = useCallback((variant: ProductVariant | undefined) => {
        setGalleryVariantId(variant?.id);
    }, []);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            <div className="space-y-6 lg:sticky lg:top-36 lg:self-start">
                <ProductImageCarousel
                    key={galleryVariant?.id ?? 'product'}
                    images={images}
                    alt={galleryVariant?.name || product.name}
                />
                <ProductVideos urls={product.customFields?.videos} title={videosTitle} />
            </div>
            <div>
                <ProductInfo
                    product={product}
                    searchParams={searchParams}
                    currencyCode={currencyCode}
                    advancePayment={advancePayment}
                    onSelectedVariantChange={handleSelectedVariantChange}
                />
            </div>
        </div>
    );
}
