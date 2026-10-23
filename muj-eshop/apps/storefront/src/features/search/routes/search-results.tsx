import {Suspense} from "react";
import {getRouteLocale} from "@/platform/i18n/server";
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {FacetFilters} from '@/features/search/facet-filters';
import {ProductGridSkeleton} from '@/features/products/product-grid-skeleton';
import {ProductGrid} from '@/features/products/product-grid';
import {AttributeResults} from '@/features/search/attribute-results';
import {getCurrentPage} from "@/features/search/search-helpers";
import {loadProductSearch} from '@/features/search/load-search';

interface SearchResultsProps {
    searchParams: Promise<{
        page?: string;
        brand?: string;
        series?: string;
        [key: string]: string | string[] | undefined;
    }>
}

function singleValue(value: string | string[] | undefined): string {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw?.trim() ?? '';
}

export async function SearchResults({searchParams}: SearchResultsProps) {
    const searchParamsResolved = await searchParams;
    const brand = singleValue(searchParamsResolved.brand);
    const series = singleValue(searchParamsResolved.series);
    if (brand || series) {
        return (
            <AttributeResults
                brand={brand || undefined}
                series={series || undefined}
                searchParams={searchParamsResolved}
            />
        );
    }

    const locale = await getRouteLocale();
    const currencyCode = await getActiveCurrencyCode();
    const page = getCurrentPage(searchParamsResolved);

    const productDataPromise = loadProductSearch({
        searchParams: searchParamsResolved,
        languageCode: locale,
        currencyCode,
    });


    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Filters Sidebar */}
            <aside className="lg:col-span-1">
                <Suspense fallback={<div className="h-64 animate-pulse bg-muted rounded-lg"/>}>
                    <FacetFilters productDataPromise={productDataPromise}/>
                </Suspense>
            </aside>

            {/* Product Grid */}
            <div className="lg:col-span-3">
                <Suspense fallback={<ProductGridSkeleton/>}>
                    <ProductGrid productDataPromise={productDataPromise} currentPage={page} take={12}/>
                </Suspense>
            </div>
        </div>
    )
}
