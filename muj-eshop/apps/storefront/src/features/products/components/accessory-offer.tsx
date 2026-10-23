'use client';

import {useState, useTransition} from 'react';
import Image from 'next/image';
import {Link} from '@/platform/i18n/navigation';
import {useTranslations} from 'next-intl';
import {CheckCircle2} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from '@/components/ui/carousel';
import {Price} from '@/features/pricing/price';
import {addToCart} from '@/features/products/add-to-cart';
import {availabilityDot, availabilityStatus, availabilityTone} from '@/features/products/availability';

export interface AccessoryProduct {
    id: string;
    name: string;
    slug: string;
    featuredAsset?: {preview: string} | null;
    availability?: string | null;
    variants: Array<{
        id: string;
        priceWithTax: number;
        currencyCode: string;
        stockLevel: string;
    }>;
}

export interface AddedProductSummary {
    name: string;
    sku?: string | null;
    priceWithTax: number;
    currencyCode: string;
    image?: string | null;
}

interface AccessoryOfferProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accessories: AccessoryProduct[];
    addedProduct: AddedProductSummary | null;
}

export function AccessoryOffer({open, onOpenChange, accessories, addedProduct}: AccessoryOfferProps) {
    const t = useTranslations('Product');
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [addedIds, setAddedIds] = useState<string[]>([]);
    const [, startAdd] = useTransition();

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            setAddedIds([]);
            setPendingId(null);
        }
        onOpenChange(nextOpen);
    };

    const addAccessory = (accessory: AccessoryProduct) => {
        const variant = accessory.variants[0];
        if (!variant || accessory.variants.length !== 1) {
            return;
        }
        setPendingId(accessory.id);
        startAdd(async () => {
            const result = await addToCart(variant.id, 1);
            setPendingId(null);
            if (result.success) {
                setAddedIds(current => current.includes(accessory.id) ? current : [...current, accessory.id]);
                toast.success(t('addedToCartMessage'), {
                    description: t('addedToCartDescription', {name: accessory.name}),
                });
            } else {
                toast.error(t('errorTitle'), {
                    description: result.error || t('errorAddToCart'),
                });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className={accessories.length > 0 ? 'gap-5 overflow-hidden sm:max-w-4xl' : 'gap-5 sm:max-w-lg'}>
                <DialogHeader className="pr-8">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold text-green-600">
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                        {t('addedToCartConfirm')}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {t('accessoriesDescription')}
                    </DialogDescription>
                </DialogHeader>

                {addedProduct && (
                    <div className="flex items-center gap-4 border-b pb-4">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                            {addedProduct.image ? (
                                <Image
                                    src={addedProduct.image}
                                    alt=""
                                    fill
                                    className="object-contain"
                                    sizes="64px"
                                />
                            ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-medium leading-snug">{addedProduct.name}</p>
                            {addedProduct.sku ? (
                                <p className="text-sm text-muted-foreground">{addedProduct.sku}</p>
                            ) : null}
                        </div>
                        <p className="shrink-0 text-lg font-semibold text-primary">
                            <Price value={addedProduct.priceWithTax} currencyCode={addedProduct.currencyCode}/>
                        </p>
                    </div>
                )}

                <div className="flex items-stretch justify-between gap-3">
                    <Button
                        variant="outline"
                        size="lg"
                        className="h-11 flex-1 whitespace-normal border-primary px-3 text-primary hover:bg-primary/5 sm:flex-none sm:px-8"
                        onClick={() => handleOpenChange(false)}
                    >
                        {t('backToShop')}
                    </Button>
                    <Button
                        size="lg"
                        className="h-11 flex-1 whitespace-normal px-3 sm:flex-none sm:px-8"
                        render={<Link href="/cart" />}
                        nativeButton={false}
                    >
                        {t('viewCart')}
                    </Button>
                </div>

                {accessories.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-center text-xl font-semibold tracking-tight">
                        {t('accessoriesTitle')}
                    </h3>
                    <Carousel opts={{align: 'start', skipSnaps: false}} className="px-10">
                        <CarouselContent className="-ml-3">
                            {accessories.map(accessory => {
                                const variant = accessory.variants[0];
                                const singleVariant = accessory.variants.length === 1 && variant;
                                const inStock = variant?.stockLevel !== 'OUT_OF_STOCK';
                                const added = addedIds.includes(accessory.id);
                                const availabilityCode = availabilityStatus(accessory.availability);
                                return (
                                    <CarouselItem
                                        key={accessory.id}
                                        className="pl-3 basis-[78%] sm:basis-1/2 lg:basis-1/3"
                                    >
                                        <article className="flex h-full flex-col overflow-hidden rounded-lg border bg-card">
                                            <Link
                                                href={`/product/${accessory.slug}`}
                                                className="relative aspect-square bg-muted"
                                            >
                                                {accessory.featuredAsset?.preview ? (
                                                    <Image
                                                        src={accessory.featuredAsset.preview}
                                                        alt=""
                                                        fill
                                                        className="object-contain p-3"
                                                        sizes="(max-width: 640px) 70vw, 240px"
                                                    />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                                        {t('noImage')}
                                                    </div>
                                                )}
                                            </Link>
                                            <div className="flex flex-1 flex-col gap-2 p-4">
                                                <Link
                                                    href={`/product/${accessory.slug}`}
                                                    className="line-clamp-3 text-sm font-medium leading-snug hover:text-primary"
                                                >
                                                    {accessory.name}
                                                </Link>
                                                {variant && (
                                                    <p className="text-lg font-semibold text-primary">
                                                        <Price value={variant.priceWithTax} currencyCode={variant.currencyCode}/>
                                                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                                                            {' '}{t('withTax')}
                                                        </span>
                                                    </p>
                                                )}
                                                <div className="mt-auto text-xs">
                                                    {availabilityCode ? (
                                                        <span className={`inline-flex items-center gap-1.5 font-medium ${availabilityTone(availabilityCode)}`}>
                                                            <span className={`h-1.5 w-1.5 rounded-full ${availabilityDot(availabilityCode)}`} />
                                                            {t(`availability.${availabilityCode}`)}
                                                        </span>
                                                    ) : variant && inStock ? (
                                                        <span className="inline-flex items-center gap-1.5 font-medium text-green-600">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                                                            {t('inStock')}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                                                            {t('outOfStock')}
                                                        </span>
                                                    )}
                                                </div>
                                                {singleVariant ? (
                                                    <Button
                                                        className="mt-1 w-full"
                                                        disabled={!inStock || pendingId === accessory.id || added}
                                                        onClick={() => addAccessory(accessory)}
                                                    >
                                                        {added ? t('accessoryAdded') : t('addAccessory')}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        className="mt-1 w-full"
                                                        variant="outline"
                                                        render={<Link href={`/product/${accessory.slug}`} />}
                                                        nativeButton={false}
                                                    >
                                                        {t('chooseVariant')}
                                                    </Button>
                                                )}
                                            </div>
                                        </article>
                                    </CarouselItem>
                                );
                            })}
                        </CarouselContent>
                        <CarouselPrevious className="left-0" />
                        <CarouselNext className="right-0" />
                    </Carousel>
                </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
