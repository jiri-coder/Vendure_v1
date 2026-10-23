export interface SearchInputParams {
    term?: string;
    collectionSlug?: string;
    take: number;
    skip: number;
    groupByProduct: boolean;
    sort: { name?: 'ASC' | 'DESC'; price?: 'ASC' | 'DESC' };
    facetValueFilters?: Array<{ and?: string; or?: string[] }>;
}

export const DIMENSION_FACET_CODES = ['vyska', 'sirka', 'hloubka'] as const;

export type DimensionFacetCode = (typeof DIMENSION_FACET_CODES)[number];

export interface DimensionFacetSource {
    facetValue: {
        id: string;
        name: string;
        facet: { code: string };
    };
}

interface BuildSearchInputOptions {
    searchParams: { [key: string]: string | string[] | undefined };
    collectionSlug?: string;
    /** Facet values from a search that does not apply the dimension range, used to map the slider onto facet ids. */
    dimensionFacetValues?: readonly DimensionFacetSource[];
}

export function parseDimensionMillimeters(name: string): number | null {
    const match = name.trim().replace(/\s+/g, '').match(/^(\d+)(?:mm)?$/i);
    if (!match) {
        return null;
    }
    const millimeters = Number(match[1]);
    return Number.isSafeInteger(millimeters) ? millimeters : null;
}

export function dimensionPoints(values: readonly DimensionFacetSource[], code: string): Array<{ id: string; value: number }> {
    const points: Array<{ id: string; value: number }> = [];
    for (const item of values) {
        if (item.facetValue.facet.code !== code) {
            continue;
        }
        const millimeters = parseDimensionMillimeters(item.facetValue.name);
        if (millimeters == null) {
            continue;
        }
        points.push({ id: item.facetValue.id, value: millimeters });
    }
    return points.sort((left, right) => left.value - right.value);
}

export function dimensionBounds(points: Array<{ value: number }>): { min: number; max: number } | null {
    if (points.length === 0) {
        return null;
    }
    return { min: points[0].value, max: points[points.length - 1].value };
}

export function readDimensionRange(
    searchParams: { [key: string]: string | string[] | undefined },
    code: string,
    bounds: { min: number; max: number },
): { min: number; max: number } {
    const raw = searchParams[code];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const match = value?.match(/^(\d+)-(\d+)$/);
    if (!match) {
        return bounds;
    }
    const min = Math.min(Number(match[1]), Number(match[2]));
    const max = Math.max(Number(match[1]), Number(match[2]));
    return { min, max };
}

export function isFullDimensionRange(
    range: { min: number; max: number },
    bounds: { min: number; max: number },
): boolean {
    return range.min <= bounds.min && range.max >= bounds.max;
}

export function buildSearchInput({ searchParams, collectionSlug, dimensionFacetValues }: BuildSearchInputOptions): SearchInputParams {
    const page = Number(searchParams.page) || 1;
    const take = 12;
    const skip = (page - 1) * take;
    const sort = (searchParams.sort as string) || 'name-asc';
    const searchTerm = searchParams.q as string;

    // Extract facet value IDs from search params
    const facetValueIds = searchParams.facets
        ? Array.isArray(searchParams.facets)
            ? searchParams.facets
            : [searchParams.facets]
        : [];

    // Map sort parameter to Vendure SearchResultSortParameter
    const sortMapping: Record<string, { name?: 'ASC' | 'DESC'; price?: 'ASC' | 'DESC' }> = {
        'name-asc': { name: 'ASC' },
        'name-desc': { name: 'DESC' },
        'price-asc': { price: 'ASC' },
        'price-desc': { price: 'DESC' },
    };

    const checkboxFilters = facetValueIds.map(id => ({ and: id }));
    const rangeFilters = dimensionFacetValues ? dimensionRangeFilters(searchParams, dimensionFacetValues) : [];
    const facetValueFilters = [...checkboxFilters, ...rangeFilters];

    return {
        ...(searchTerm && { term: searchTerm }),
        ...(collectionSlug && { collectionSlug }),
        take,
        skip,
        groupByProduct: true,
        sort: sortMapping[sort] || sortMapping['name-asc'],
        ...(facetValueFilters.length > 0 && { facetValueFilters }),
    };
}

export function getCurrentPage(searchParams: { [key: string]: string | string[] | undefined }): number {
    return Number(searchParams.page) || 1;
}

function dimensionRangeFilters(
    searchParams: { [key: string]: string | string[] | undefined },
    dimensionFacetValues: readonly DimensionFacetSource[],
): Array<{ and: string } | { or: string[] }> {
    const filters: Array<{ and: string } | { or: string[] }> = [];
    for (const code of DIMENSION_FACET_CODES) {
        const points = dimensionPoints(dimensionFacetValues, code);
        const bounds = dimensionBounds(points);
        if (!bounds) {
            continue;
        }
        const range = readDimensionRange(searchParams, code, bounds);
        if (isFullDimensionRange(range, bounds)) {
            continue;
        }
        const ids = points
            .filter(point => point.value >= range.min && point.value <= range.max)
            .map(point => point.id);
        filters.push(ids.length > 0 ? { or: ids } : { and: '-1' });
    }
    return filters;
}
