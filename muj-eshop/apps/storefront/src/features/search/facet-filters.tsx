'use client';

import { use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/platform/i18n/navigation';
import { ResultOf } from '@/platform/vendure/graphql';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Slider } from '@/components/ui/slider';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import {SearchProductsQuery} from '@/features/search/graphql';
import {useTranslations} from 'next-intl';
import {
    DIMENSION_FACET_CODES,
    DimensionFacetCode,
    dimensionBounds,
    dimensionPoints,
    isFullDimensionRange,
    readDimensionRange,
} from '@/features/search/search-helpers';

/** Known filters stay in a stable order. Other category filters keep the order chosen in the admin. */
const PREFERRED_FACET_ORDER = ['vyska', 'sirka', 'hloubka', 'vypln', 'otevirani', 'tloustka-skla'];

function orderedFacetCodes(codes: readonly string[]): string[] {
    return [...codes].sort((left, right) => {
        const leftIndex = PREFERRED_FACET_ORDER.indexOf(left);
        const rightIndex = PREFERRED_FACET_ORDER.indexOf(right);
        if (leftIndex === -1 && rightIndex === -1) {
            return 0;
        }
        if (leftIndex === -1) {
            return 1;
        }
        if (rightIndex === -1) {
            return -1;
        }
        return leftIndex - rightIndex;
    });
}

function compareFacetValues(left: string, right: string): number {
    const leftNumber = Number.parseFloat(left.replace(',', '.'));
    const rightNumber = Number.parseFloat(right.replace(',', '.'));
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
    }
    return left.localeCompare(right, 'cs');
}

type SearchFacetValues = ResultOf<typeof SearchProductsQuery>['search']['facetValues'];

interface FacetFiltersProps {
    productDataPromise: Promise<{
        data: ResultOf<typeof SearchProductsQuery>;
        dimensionFacetValues?: SearchFacetValues;
        token?: string;
    }>;
    /** When set, only these facet codes are shown, in this order. Omit on search to show every facet in the result. */
    allowedFacetCodes?: readonly string[];
}

function isDimensionCode(code: string): code is DimensionFacetCode {
    return (DIMENSION_FACET_CODES as readonly string[]).includes(code);
}

function DimensionSlider({
    min,
    max,
    value,
    onChange,
    onCommit,
}: {
    min: number;
    max: number;
    value: [number, number];
    onChange: (value: [number, number]) => void;
    onCommit: (value: [number, number]) => void;
}) {
    if (min === max) {
        return <p className="pb-2 text-sm text-muted-foreground">{min} mm</p>;
    }

    return (
        <div className="space-y-3 pb-3">
            <div className="flex items-center justify-between text-sm tabular-nums">
                <span>{value[0]} mm</span>
                <span>{value[1]} mm</span>
            </div>
            <Slider
                min={min}
                max={max}
                step={1}
                value={value}
                onValueChange={(next) => {
                    if (Array.isArray(next) && next.length === 2) {
                        onChange([next[0], next[1]]);
                    }
                }}
                onValueCommitted={(next) => {
                    if (Array.isArray(next) && next.length === 2) {
                        onCommit([next[0], next[1]]);
                    }
                }}
            />
        </div>
    );
}

function FilterContent({
    facetGroups,
    dimensions,
    selectedFacets,
    toggleFacet,
    setDimensionRange,
    clearFilters,
    hasActiveFilters,
}: {
    facetGroups: Record<string, { id: string; name: string; values: Array<{ id: string; name: string; count: number }> }>;
    dimensions: Array<{
        code: DimensionFacetCode;
        name: string;
        min: number;
        max: number;
        value: [number, number];
        active: boolean;
    }>;
    selectedFacets: string[];
    toggleFacet: (facetId: string) => void;
    setDimensionRange: (code: DimensionFacetCode, value: [number, number]) => void;
    clearFilters: () => void;
    hasActiveFilters: boolean;
}) {
    const t = useTranslations('Filters');
    const [ranges, setRanges] = useState<Record<string, [number, number]>>({});

    const rangeKey = dimensions.map(dimension => `${dimension.code}:${dimension.min}-${dimension.max}:${dimension.value[0]}-${dimension.value[1]}`).join('|');

    useEffect(() => {
        setRanges(Object.fromEntries(dimensions.map(dimension => [dimension.code, dimension.value])));
    }, [rangeKey]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">{t('title')}</h2>
                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                        {t('clearAll')}
                    </Button>
                )}
            </div>

            {dimensions.map(dimension => (
                <Collapsible key={dimension.code} defaultOpen>
                    <div className="space-y-2">
                        <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium hover:text-foreground transition-colors">
                            {dimension.name}
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-panel-open]_&]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <DimensionSlider
                                min={dimension.min}
                                max={dimension.max}
                                value={ranges[dimension.code] ?? dimension.value}
                                onChange={value => setRanges(current => ({...current, [dimension.code]: value}))}
                                onCommit={value => setDimensionRange(dimension.code, value)}
                            />
                        </CollapsibleContent>
                    </div>
                </Collapsible>
            ))}

            {Object.entries(facetGroups).map(([facetName, facet]) => (
                <Collapsible key={facet.id} defaultOpen>
                    <div className="space-y-2">
                        <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium hover:text-foreground transition-colors">
                            {facetName}
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-panel-open]_&]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="space-y-2 pb-2">
                                {facet.values.map((value) => {
                                    const isChecked = selectedFacets.includes(value.id);
                                    return (
                                        <div key={value.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`filter-${value.id}`}
                                                checked={isChecked}
                                                onCheckedChange={() => toggleFacet(value.id)}
                                            />
                                            <Label
                                                htmlFor={`filter-${value.id}`}
                                                className="text-sm font-normal cursor-pointer flex items-center gap-2"
                                            >
                                                {value.name}
                                                <span className="text-xs text-muted-foreground">
                                                    ({value.count})
                                                </span>
                                            </Label>
                                        </div>
                                    );
                                })}
                            </div>
                        </CollapsibleContent>
                    </div>
                </Collapsible>
            ))}
        </div>
    );
}

export function FacetFilters({ productDataPromise, allowedFacetCodes }: FacetFiltersProps) {
    const t = useTranslations('Filters');
    const result = use(productDataPromise);
    const searchResult = result.data.search;
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [sheetOpen, setSheetOpen] = useState(false);

    interface FacetGroup {
        id: string;
        name: string;
        values: Array<{ id: string; name: string; count: number }>;
    }

    const boundsFacetValues = result.dimensionFacetValues ?? searchResult.facetValues;
    const searchParamRecord = Object.fromEntries(searchParams.entries());
    const allowed = allowedFacetCodes ? new Set(allowedFacetCodes) : null;

    const dimensions = DIMENSION_FACET_CODES.flatMap(code => {
        if (allowed && !allowed.has(code)) {
            return [];
        }
        const points = dimensionPoints(boundsFacetValues, code);
        const bounds = dimensionBounds(points);
        if (!bounds) {
            return [];
        }
        const range = readDimensionRange(searchParamRecord, code, bounds);
        const name = boundsFacetValues.find(item => item.facetValue.facet.code === code)?.facetValue.facet.name ?? code;
        return [{
            code,
            name,
            min: bounds.min,
            max: bounds.max,
            value: [
                Math.min(bounds.max, Math.max(bounds.min, range.min)),
                Math.min(bounds.max, Math.max(bounds.min, range.max)),
            ] as [number, number],
            active: !isFullDimensionRange(range, bounds),
        }];
    });

    const grouped = searchResult.facetValues.reduce((acc: Record<string, FacetGroup>, item) => {
        const code = item.facetValue.facet.code;
        if (isDimensionCode(code) || (allowed && !allowed.has(code))) {
            return acc;
        }
        if (!acc[code]) {
            acc[code] = {
                id: code,
                name: item.facetValue.facet.name,
                values: [],
            };
        }
        acc[code].values.push({
            id: item.facetValue.id,
            name: item.facetValue.name,
            count: item.count,
        });
        return acc;
    }, {});
    for (const group of Object.values(grouped)) {
        group.values.sort((left, right) => compareFacetValues(left.name, right.name));
    }

    const checkboxCodes = allowedFacetCodes
        ? orderedFacetCodes(allowedFacetCodes).filter(code => !isDimensionCode(code))
        : orderedFacetCodes([...new Set(searchResult.facetValues.map(item => item.facetValue.facet.code))].filter(code => !isDimensionCode(code)));
    const facetGroups = checkboxCodes.reduce((acc: Record<string, FacetGroup>, code) => {
        const group = grouped[code];
        if (group) {
            acc[group.name] = group;
        }
        return acc;
    }, {});

    const selectedFacets = searchParams.getAll('facets');
    const activeDimensionCount = dimensions.filter(dimension => dimension.active).length;

    const toggleFacet = (facetId: string) => {
        const params = new URLSearchParams(searchParams);
        const current = params.getAll('facets');

        if (current.includes(facetId)) {
            params.delete('facets');
            current.filter(id => id !== facetId).forEach(id => params.append('facets', id));
        } else {
            params.append('facets', facetId);
        }

        // Reset to page 1 when filters change
        params.delete('page');

        router.push(`${pathname}?${params.toString()}`);
        setSheetOpen(false);
    };

    const clearFilters = () => {
        const params = new URLSearchParams(searchParams);
        params.delete('facets');
        params.delete('page');
        for (const code of DIMENSION_FACET_CODES) {
            params.delete(code);
        }
        router.push(`${pathname}?${params.toString()}`);
        setSheetOpen(false);
    };

    const setDimensionRange = (code: DimensionFacetCode, value: [number, number]) => {
        const dimension = dimensions.find(item => item.code === code);
        if (!dimension) {
            return;
        }
        const params = new URLSearchParams(searchParams);
        if (isFullDimensionRange({min: value[0], max: value[1]}, {min: dimension.min, max: dimension.max})) {
            params.delete(code);
        } else {
            params.set(code, `${value[0]}-${value[1]}`);
        }
        params.delete('page');
        router.push(`${pathname}?${params.toString()}`);
    };

    const hasActiveFilters = selectedFacets.length > 0 || activeDimensionCount > 0;

    if (Object.keys(facetGroups).length === 0 && dimensions.length === 0) {
        return null;
    }

    const filterContentProps = {
        facetGroups,
        dimensions,
        selectedFacets,
        toggleFacet,
        setDimensionRange,
        clearFilters,
        hasActiveFilters,
    };

    return (
        <>
            {/* Mobile: Sheet trigger */}
            <div className="lg:hidden">
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetTrigger
                        render={
                            <Button variant="outline" className="w-full">
                                <SlidersHorizontal className="mr-2 h-4 w-4" />
                                {t('filtersButton')}
                                {hasActiveFilters && (
                                    <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                                        {selectedFacets.length + activeDimensionCount}
                                    </span>
                                )}
                            </Button>
                        }
                    />
                    <SheetContent side="left" className="overflow-y-auto p-6">
                        <SheetHeader>
                            <SheetTitle>{t('title')}</SheetTitle>
                        </SheetHeader>
                        <div className="mt-4">
                            <FilterContent {...filterContentProps} />
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop: Inline filters */}
            <div className="hidden lg:block">
                <FilterContent {...filterContentProps} />
            </div>
        </>
    );
}
