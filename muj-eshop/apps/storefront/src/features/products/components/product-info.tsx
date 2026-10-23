'use client';

import {useState, useMemo, useTransition, useEffect} from 'react';
import {useSearchParams} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {usePathname, useRouter, Link} from '@/platform/i18n/navigation';
import {Button} from '@/components/ui/button';
import {Label} from '@/components/ui/label';
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group';
import {Separator} from '@/components/ui/separator';
import {ShoppingCart, CheckCircle2} from 'lucide-react';
import {addToCart} from '@/features/products/add-to-cart';
import {AccessoryOffer, type AccessoryProduct} from '@/features/products/components/accessory-offer';
import {availabilityDot, availabilityStatus, availabilityTone, saleableStockCount} from '@/features/products/availability';
import {getSelectedVariant, selectedOptionsFromSearchParams} from '@/features/products/product-options';
import {loadProductAccessories} from '@/features/products/load-product-accessories';
import {toast} from 'sonner';
import {Price} from '@/features/pricing/price';
import {calculatePaymentAdjustment} from '@/features/pricing/payment-adjustment';
import {toIntlLocale} from '@/platform/i18n/locale-utils';
import type {ResultOf} from '@/platform/vendure/graphql';
import type {GetProductDetailQuery} from '@/features/products/graphql';

type ProductDetail = NonNullable<ResultOf<typeof GetProductDetailQuery>['product']>;

interface AdvancePaymentOffer {
    percentageRate: number;
    fixedFee: number;
}

interface ProductInfoProps {
    product: ProductDetail;
    searchParams: { [key: string]: string | string[] | undefined };
    currencyCode: string;
    advancePayment: AdvancePaymentOffer | null;
    onSelectedVariantChange?: (variant: ProductDetail['variants'][number] | undefined) => void;
}

function formatSignedPercent(rate: number, locale: string): string {
    const absolute = Math.abs(rate);
    const digits = Number.isInteger(absolute) ? 0 : 1;
    const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(absolute);
    return `${rate < 0 ? '−' : '+'}${formatted} %`;
}

export function ProductInfo({product, searchParams, currencyCode, advancePayment, onSelectedVariantChange}: ProductInfoProps) {
    const t = useTranslations('Product');
    const intlLocale = toIntlLocale(useLocale());
    const pathname = usePathname();
    const router = useRouter();
    const currentSearchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [isAdded, setIsAdded] = useState(false);
    const [accessoriesOpen, setAccessoriesOpen] = useState(false);
    const [offerAccessories, setOfferAccessories] = useState<AccessoryProduct[]>([]);

    // Initialize selected options from URL
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() =>
        selectedOptionsFromSearchParams(product, searchParams),
    );

    const selectedVariant = useMemo(
        () => getSelectedVariant(product, selectedOptions),
        [selectedOptions, product],
    );

    useEffect(() => {
        onSelectedVariantChange?.(selectedVariant);
    }, [onSelectedVariantChange, selectedVariant]);

    const handleOptionChange = (groupId: string, optionId: string) => {
        setSelectedOptions((prev) => ({
            ...prev,
            [groupId]: optionId,
        }));

        // Find the option group and option to get their codes
        const group = product.optionGroups.find((g) => g.id === groupId);
        const option = group?.options.find((opt) => opt.id === optionId);

        if (group && option) {
            // Update URL with option code
            const params = new URLSearchParams(currentSearchParams);
            params.set(group.code, option.code);
            router.push(`${pathname}?${params.toString()}`, {scroll: false});
        }
    };

    const accessories: AccessoryProduct[] = (product.customFields?.relatedProducts ?? []).flatMap(item => {
        if (!item.enabled || item.id === product.id || item.variants.length === 0) {
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
    const availabilityCode = availabilityStatus(
        selectedVariant?.customFields?.availability || product.customFields?.availability,
    );
    const stockCount = selectedVariant ? saleableStockCount(selectedVariant.stockLevel) : null;

    const handleAddToCart = async () => {
        if (!selectedVariant) return;

        startTransition(async () => {
            const result = await addToCart(selectedVariant.id, 1);

            if (result.success) {
                setIsAdded(true);
                setOfferAccessories(accessories);
                setAccessoriesOpen(true);
                try {
                    const freshAccessories = await loadProductAccessories(product.slug, product.id);
                    setOfferAccessories(freshAccessories);
                } catch {
                    setOfferAccessories(accessories);
                }

                // Reset the added state after 2 seconds
                setTimeout(() => setIsAdded(false), 2000);
            } else {
                toast.error(t('errorTitle'), {
                    description: result.error || t('errorAddToCart'),
                });
            }
        });
    };

    const isInStock = selectedVariant && selectedVariant.stockLevel !== 'OUT_OF_STOCK';
    const isSoldOut = availabilityCode === 'SOLD_OUT';
    const canAddToCart = selectedVariant && isInStock && !isSoldOut;
    const brand = product.customFields?.brand?.trim() || '';
    const series = product.customFields?.series?.trim() || '';
    const recommendedPrice = selectedVariant?.customFields?.recommendedPrice;
    const showRecommendedPrice = selectedVariant != null
        && recommendedPrice != null
        && recommendedPrice > selectedVariant.priceWithTax;
    const prepaidAdjustment = selectedVariant && advancePayment
        ? calculatePaymentAdjustment(
            selectedVariant.priceWithTax,
            advancePayment.fixedFee,
            advancePayment.percentageRate,
        )
        : 0;
    const prepaidSavings = prepaidAdjustment < 0 ? -prepaidAdjustment : 0;
    const prepaidPercent = advancePayment && advancePayment.percentageRate < 0
        ? formatSignedPercent(advancePayment.percentageRate, intlLocale)
        : null;

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                {(brand || series) && (
                    <p className="text-sm font-medium">
                        {brand && (
                            <Link
                                href={`/search?brand=${encodeURIComponent(brand)}`}
                                className="text-primary hover:underline"
                            >
                                {brand}
                            </Link>
                        )}
                        {brand && series && <span className="text-muted-foreground"> · </span>}
                        {series && (
                            <Link
                                href={`/search?series=${encodeURIComponent(series)}`}
                                className="text-primary hover:underline"
                            >
                                {series}
                            </Link>
                        )}
                    </p>
                )}
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{product.name}</h1>
                {(product.customFields?.isNew || product.customFields?.onSale) && (
                    <div className="flex flex-wrap gap-2">
                        {product.customFields?.isNew && (
                            <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                                {t('newBadge')}
                            </span>
                        )}
                        {product.customFields?.onSale && (
                            <span className="rounded-full bg-destructive px-2.5 py-1 text-xs font-semibold text-white">
                                {t('saleBadge')}
                            </span>
                        )}
                    </div>
                )}
                {selectedVariant && (selectedVariant.sku || selectedVariant.customFields?.ean) && (
                    <p className="text-sm text-muted-foreground">
                        {selectedVariant.sku && (
                            <span>{t('catalogNumber')}: {selectedVariant.sku}</span>
                        )}
                        {selectedVariant.sku && selectedVariant.customFields?.ean && (
                            <span> · </span>
                        )}
                        {selectedVariant.customFields?.ean && (
                            <span>{t('ean')}: {selectedVariant.customFields.ean}</span>
                        )}
                    </p>
                )}
                {selectedVariant && (
                    <div className="space-y-1 pt-1">
                        {showRecommendedPrice && recommendedPrice != null && (
                            <p className="text-sm text-muted-foreground">
                                {t('recommendedPrice')}{' '}
                                <span className="line-through">
                                    <Price value={recommendedPrice} currencyCode={currencyCode}/>
                                </span>
                            </p>
                        )}
                        <p className="text-3xl md:text-4xl font-bold tracking-tight">
                            <span className="sr-only">{t('sellingPrice')} </span>
                            <Price value={selectedVariant.priceWithTax} currencyCode={currencyCode}/>
                            <span className="ml-2 text-base font-normal text-muted-foreground"> {t('withTax')}</span>
                        </p>
                        {prepaidSavings > 0 && (
                            <p className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
                                {prepaidPercent && <span>{prepaidPercent} · </span>}
                                {t('advancePaymentSave')}{' '}
                                <Price value={prepaidSavings} currencyCode={currencyCode}/>
                            </p>
                        )}
                    </div>
                )}
            </div>

            <Separator />

            {/* Option Groups */}
            {product.optionGroups.length > 0 && (
                <div className="space-y-5">
                    {product.optionGroups.map((group) => (
                        <div key={group.id} className="space-y-3">
                            <Label className="text-base font-semibold">
                                {group.name}
                            </Label>
                            <RadioGroup
                                value={selectedOptions[group.id] || ''}
                                onValueChange={(value) => handleOptionChange(group.id, value)}
                            >
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {group.options.map((option) => (
                                        <div key={option.id}>
                                            <RadioGroupItem
                                                value={option.id}
                                                id={option.id}
                                                className="peer sr-only"
                                            />
                                            <Label
                                                htmlFor={option.id}
                                                className="flex items-center justify-center rounded-lg border-2 border-muted bg-popover px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground peer-data-[checked]:border-primary peer-data-[checked]:ring-2 peer-data-[checked]:ring-primary/20 peer-data-[checked]:bg-primary/5 cursor-pointer transition-all"
                                            >
                                                {option.name}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </RadioGroup>
                        </div>
                    ))}
                </div>
            )}

            {/* Stock Status */}
            {selectedVariant && (
                <div className="text-sm">
                    {availabilityCode ? (
                        <span className={`inline-flex items-center gap-1.5 font-medium ${availabilityTone(availabilityCode)}`}>
                            <span className={`h-2 w-2 rounded-full ${availabilityDot(availabilityCode)}`} />
                            {t(`availability.${availabilityCode}`)}
                            {stockCount != null && stockCount > 0 && (
                                <span className="font-normal text-muted-foreground">
                                    ({t('stockCount', {count: stockCount})})
                                </span>
                            )}
                        </span>
                    ) : isInStock ? (
                        <span className="inline-flex items-center gap-1.5 text-green-600 font-medium">
                            <span className="h-2 w-2 rounded-full bg-green-600" />
                            {t('inStock')}
                            {stockCount != null && stockCount > 0 && (
                                <span className="font-normal text-muted-foreground">
                                    ({t('stockCount', {count: stockCount})})
                                </span>
                            )}
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 text-destructive font-medium">
                            <span className="h-2 w-2 rounded-full bg-destructive" />
                            {t('outOfStock')}
                        </span>
                    )}
                </div>
            )}

            {/* Add to Cart Button */}
            <div className="pt-2 space-y-3">
                <Button
                    size="lg"
                    className="w-full h-12 text-base font-semibold rounded-lg"
                    disabled={!canAddToCart || isPending}
                    onClick={handleAddToCart}
                >
                    {isAdded ? (
                        <>
                            <CheckCircle2 className="mr-2 h-5 w-5"/>
                            {t('addedToCart')}
                        </>
                    ) : (
                        <>
                            <ShoppingCart className="mr-2 h-5 w-5"/>
                            {isPending
                                ? t('adding')
                                : !selectedVariant && product.optionGroups.length > 0
                                    ? t('selectOptions')
                                    : isSoldOut
                                        ? t('availability.SOLD_OUT')
                                        : !isInStock
                                            ? t('outOfStock')
                                            : t('addToCart')}
                        </>
                    )}
                </Button>
            </div>

            <AccessoryOffer
                open={accessoriesOpen}
                onOpenChange={setAccessoriesOpen}
                accessories={offerAccessories}
                addedProduct={selectedVariant ? {
                    name: product.name,
                    sku: selectedVariant.sku,
                    priceWithTax: selectedVariant.priceWithTax,
                    currencyCode,
                    image: selectedVariant.featuredAsset?.preview
                        ?? selectedVariant.assets[0]?.preview
                        ?? product.featuredAsset?.preview
                        ?? product.assets[0]?.preview
                        ?? null,
                } : null}
            />
        </div>
    );
}

