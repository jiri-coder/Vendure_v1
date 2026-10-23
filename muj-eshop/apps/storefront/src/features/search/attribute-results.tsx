import Image from 'next/image';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/platform/i18n/navigation';
import {getRouteLocale} from '@/platform/i18n/server';
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {Pagination} from '@/features/products/components/pagination';
import {Price} from '@/features/pricing/price';
import {ProductsByAttributeQuery} from '@/features/products/graphql';
import {query} from '@/platform/vendure/api';
import {getCurrentPage} from '@/features/search/search-helpers';

const PAGE_SIZE = 12;

interface AttributeResultsProps {
    brand?: string;
    series?: string;
    searchParams: {[key: string]: string | string[] | undefined};
}

export async function AttributeResults({brand, series, searchParams}: AttributeResultsProps) {
    const locale = await getRouteLocale();
    const currencyCode = await getActiveCurrencyCode();
    const t = await getTranslations({locale, namespace: 'Product'});
    const page = getCurrentPage(searchParams);
    const result = await query(ProductsByAttributeQuery, {
        options: {
            take: PAGE_SIZE,
            skip: (page - 1) * PAGE_SIZE,
            sort: {name: 'ASC'},
            filter: {
                ...(brand ? {brand: {eq: brand}} : {}),
                ...(series ? {series: {eq: series}} : {}),
            },
        },
    }, {languageCode: locale, currencyCode});

    const products = result.data.products;
    const totalPages = Math.ceil(products.totalItems / PAGE_SIZE);

    if (!products.items.length) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">{t('noProductsFound')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <p className="text-sm text-muted-foreground">
                {t('productCount', {count: products.totalItems})}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.items.map(product => {
                    const prices = product.variants.map(variant => variant.priceWithTax);
                    const min = Math.min(...prices);
                    const max = Math.max(...prices);
                    const productCurrency = product.variants[0]?.currencyCode ?? currencyCode;
                    return (
                        <Link
                            key={product.id}
                            href={`/product/${product.slug}`}
                            className="group block bg-card rounded-xl overflow-hidden border border-border hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                        >
                            <div className="aspect-square relative bg-muted overflow-hidden">
                                {product.featuredAsset ? (
                                    <Image
                                        src={product.featuredAsset.preview}
                                        alt={product.name}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-all duration-500"
                                        sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 1024px) 50vw, 33vw"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                        {t('noImage')}
                                    </div>
                                )}
                            </div>
                            <div className="p-4 space-y-2">
                                <h3 className="font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                    {product.name}
                                </h3>
                                <p className="text-lg font-bold tracking-tight">
                                    {min !== max && (
                                        <span className="text-xs font-normal text-muted-foreground mr-1">{t('from')} </span>
                                    )}
                                    <Price value={min} currencyCode={productCurrency}/>
                                </p>
                            </div>
                        </Link>
                    );
                })}
            </div>
            {totalPages > 1 && (
                <Pagination currentPage={page} totalPages={totalPages}/>
            )}
        </div>
    );
}
