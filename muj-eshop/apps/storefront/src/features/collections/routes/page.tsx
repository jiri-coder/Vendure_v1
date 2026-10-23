import type { Metadata } from 'next';
import { Fragment, Suspense } from 'react';
import { Link } from '@/platform/i18n/navigation';
import { query } from '@/platform/vendure/api';
import {CollectionImage} from '@/features/collections/collection-image';
import {GetCollectionProductsQuery, collectionFilterFacetCodes} from '@/features/collections/graphql';
import {ProductGrid} from '@/features/products/product-grid';
import {FacetFilters} from '@/features/search/facet-filters';
import {ProductGridSkeleton} from '@/features/products/product-grid-skeleton';
import { getCurrentPage } from '@/features/search/search-helpers';
import { loadProductSearch } from '@/features/search/load-search';
import { cacheLife, cacheTag } from 'next/cache';
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { routing } from '@/platform/i18n/routing';
import {
    SITE_NAME,
    truncateDescription,
    buildCanonicalUrl,
    buildOgImages,
} from '@/config/metadata';
import {toOgLocale} from '@/platform/i18n/locale-utils';
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {getRouteLocale} from '@/platform/i18n/server';
import {getTranslations} from 'next-intl/server';

async function getCollectionProducts(slug: string, searchParams: { [key: string]: string | string[] | undefined }, currencyCode: string) {
    'use cache';
    cacheLife('hours');

    const locale = await getRouteLocale();
    cacheTag(`collection-${slug}-${locale}-${currencyCode}`);
    cacheTag('collection');

    return loadProductSearch({
        searchParams,
        collectionSlug: slug,
        languageCode: locale,
        currencyCode,
    });
}

async function getCollectionMetadata(slug: string) {
    'use cache';
    cacheLife('hours');

    const locale = await getRouteLocale();
    cacheTag(`collection-meta-${slug}-${locale}-image`);

    return query(GetCollectionProductsQuery, {
        slug,
        input: { take: 0, collectionSlug: slug, groupByProduct: true },
    }, {languageCode: locale});
}

export async function generateMetadata({
    params,
}: PageProps<'/[locale]/collection/[slug]'>): Promise<Metadata> {
    const { slug } = await params;
    const locale = await getRouteLocale();
    const result = await getCollectionMetadata(slug);
    const collection = result.data.collection;

    const t = await getTranslations({locale, namespace: 'Collection'});

    if (!collection) {
        return {
            title: t('collectionNotFound'),
        };
    }

    const description =
        truncateDescription(collection.description) ||
        t('browseCollectionAt', {name: collection.name, siteName: SITE_NAME});
    const ogLocale = toOgLocale(locale);
    const collectionPath = `/collection/${collection.slug}`;

    return {
        title: collection.name,
        description,
        alternates: {
            canonical: buildCanonicalUrl(`/${locale}${collectionPath}`),
            languages: Object.fromEntries(
                routing.locales.map((l) => [l, buildCanonicalUrl(`/${l}${collectionPath}`)])
            ),
        },
        openGraph: {
            title: collection.name,
            description,
            type: 'website',
            locale: ogLocale,
            url: buildCanonicalUrl(`/${locale}${collectionPath}`),
            images: buildOgImages(collection.featuredAsset?.preview, collection.name),
        },
        twitter: {
            card: 'summary_large_image',
            title: collection.name,
            description,
            images: collection.featuredAsset?.preview
                ? [collection.featuredAsset.preview]
                : undefined,
        },
    };
}

type CollectionChild = {
    id: string;
    name: string;
    slug: string;
    position: number;
    featuredAsset?: {preview: string} | null;
    children?: Array<{id: string; name: string; slug: string; position: number}> | null;
};

function byPosition<T extends {position: number}>(items: readonly T[]): T[] {
    return [...items].sort((left, right) => left.position - right.position);
}

async function CollectionCatalog({
    productDataPromise,
    allowedFacetCodes,
    page,
    hasSubcategories,
}: {
    productDataPromise: ReturnType<typeof getCollectionProducts>;
    allowedFacetCodes: string[];
    page: number;
    hasSubcategories: boolean;
}) {
    const result = await productDataPromise;
    if (hasSubcategories && result.data.search.items.length === 0) {
        return null;
    }

    const resolved = Promise.resolve(result);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <aside className="lg:col-span-1">
                <FacetFilters
                    productDataPromise={resolved}
                    allowedFacetCodes={allowedFacetCodes}
                />
            </aside>
            <div className="lg:col-span-3">
                <ProductGrid productDataPromise={resolved} currentPage={page} take={12} />
            </div>
        </div>
    );
}

function SubcategoryList({
    children,
    heading,
}: {
    children: readonly CollectionChild[];
    heading: string;
}) {
    const subcategories = byPosition(children);

    return (
        <section className="mb-10" aria-label={heading}>
            <h2 className="mb-4 text-xl font-semibold tracking-tight">{heading}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {subcategories.map(child => {
                    const grandchildren = byPosition(child.children ?? []);
                    return (
                        <div key={child.id} className="group overflow-hidden rounded-xl border bg-card">
                            <Link href={`/collection/${child.slug}`} className="block hover:text-primary">
                                <CollectionImage
                                    src={child.featuredAsset?.preview}
                                    alt=""
                                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                                />
                                <span className="block p-5 pb-0 font-semibold">{child.name}</span>
                            </Link>
                            <div className="p-5 pt-0">
                                {grandchildren.length > 0 && (
                                    <ul className="mt-3 space-y-1.5">
                                        {grandchildren.map(grandchild => (
                                            <li key={grandchild.id}>
                                                <Link
                                                    href={`/collection/${grandchild.slug}`}
                                                    className="text-sm text-muted-foreground hover:text-foreground"
                                                >
                                                    {grandchild.name}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export default async function CollectionPage({params, searchParams}: PageProps<'/[locale]/collection/[slug]'>) {
    const { slug } = await params;
    const searchParamsResolved = await searchParams;
    const locale = await getRouteLocale();
    const currencyCode = await getActiveCurrencyCode();
    const t = await getTranslations({locale, namespace: 'Collection'});
    const page = getCurrentPage(searchParamsResolved);

    const productDataPromise = getCollectionProducts(slug, searchParamsResolved, currencyCode);
    const collectionResult = await getCollectionMetadata(slug);
    const collection = collectionResult.data.collection;
    const collectionName = collection?.name ?? slug;
    const allowedFacetCodes = collectionFilterFacetCodes(collection);
    const subcategories = collection?.children ?? [];
    const breadcrumbTrail = (collection?.breadcrumbs ?? []).filter(
        item => item.slug && item.slug !== '__root_collection__',
    );
    const ancestorCollections = breadcrumbTrail.slice(0, -1);
    const currentCollectionName = breadcrumbTrail.at(-1)?.name ?? collectionName;

    return (
        <div className="container mx-auto px-4 py-8 mt-16">
            {/* Breadcrumbs */}
            <Breadcrumb className="mb-6">
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink render={<Link href="/" />}>{t('home')}</BreadcrumbLink>
                    </BreadcrumbItem>
                    {ancestorCollections.map(item => (
                        <Fragment key={item.id}>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbLink render={<Link href={`/collection/${item.slug}`} />}>
                                    {item.name}
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                        </Fragment>
                    ))}
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{currentCollectionName}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            {/* Collection Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">{collectionName}</h1>
            </div>

            {subcategories.length > 0 && (
                <SubcategoryList children={subcategories} heading={t('subcategories')} />
            )}

            <Suspense fallback={<ProductGridSkeleton />}>
                <CollectionCatalog
                    productDataPromise={productDataPromise}
                    allowedFacetCodes={allowedFacetCodes}
                    page={page}
                    hasSubcategories={subcategories.length > 0}
                />
            </Suspense>
        </div>
    );
}
