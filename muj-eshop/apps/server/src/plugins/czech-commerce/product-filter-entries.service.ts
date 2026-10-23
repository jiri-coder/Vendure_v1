import { Injectable, OnModuleInit } from '@nestjs/common';
import {
    EventBus,
    Facet,
    FacetService,
    FacetValue,
    FacetValueService,
    ID,
    LanguageCode,
    Logger,
    Product,
    ProductEvent,
    ProductService,
    ProductVariantService,
    RequestContext,
    TransactionalConnection,
    Translated,
} from '@vendure/core';
import { FILTER_FACETS, LABEL_FACET_CODE } from './filter-facets';

type FilterEntry = {
    facet?: string | null;
    value?: string | null;
};

const BRAND_FACET_CODE = 'brand';

const SUPERIOR_PARAMETERS = [
    { label: 'Značka', keys: ['znacka', 'brand'] },
    { label: 'Série', keys: ['serie', 'series'] },
    { label: 'Záruka', keys: ['zaruka', 'warranty'] },
] as const;

const DIMENSION_FACET_CODES = new Set(['vyska', 'sirka', 'hloubka']);

const diacritics: Record<string, string> = {
    á: 'a', ä: 'a', č: 'c', ď: 'd', é: 'e', ě: 'e', í: 'i', ň: 'n',
    ó: 'o', ř: 'r', š: 's', ť: 't', ú: 'u', ů: 'u', ý: 'y', ž: 'z',
};

@Injectable()
export class ProductFilterEntryService implements OnModuleInit {
    private readonly syncingProductIds = new Set<string>();

    constructor(
        private readonly eventBus: EventBus,
        private readonly connection: TransactionalConnection,
        private readonly productService: ProductService,
        private readonly facetService: FacetService,
        private readonly facetValueService: FacetValueService,
        private readonly productVariantService: ProductVariantService,
    ) {}

    onModuleInit() {
        this.eventBus.registerBlockingEventHandler({
            event: ProductEvent,
            id: 'sync-product-filter-entries',
            handler: event => this.handleProductEvent(event),
        });
    }

    private async handleProductEvent(event: ProductEvent) {
        if (event.type === 'deleted') {
            return;
        }
        const productId = String(event.entity.id);
        if (this.syncingProductIds.has(productId)) {
            return;
        }
        const entries = readFilterEntries(event.input);
        const catalog = readCatalogFields(event.input);
        const flags = readLabelFlags(event.input);
        if (!entries && !catalog && !flags) {
            return;
        }
        this.syncingProductIds.add(productId);
        try {
            await this.sync(event.ctx, event.entity, entries, catalog, flags);
        } catch (error) {
            Logger.error(
                `Hodnoty filtrů produktu ${productId} se nepodařilo uložit: ${error instanceof Error ? error.message : String(error)}`,
                'ProductFilterEntries',
            );
            throw error;
        } finally {
            this.syncingProductIds.delete(productId);
        }
    }

    private async sync(
        ctx: RequestContext,
        savedProduct: Product,
        entries: FilterEntry[] | undefined,
        catalog: CatalogFields | undefined,
        flags: LabelFlags | undefined,
    ) {
        const productId = savedProduct.id;
        const wanted = new Map<string, Set<string>>();
        const normalizedEntries: Array<{ facet: string; value: string }> = [];
        for (const entry of entries ?? []) {
            const facetLabel = entry.facet?.trim() ?? '';
            const facetCode = resolveFacetCode(facetLabel);
            const rawValue = entry.value?.trim() ?? '';
            if (!facetCode || !rawValue) {
                continue;
            }
            const value = normalizeFilterValue(facetCode, rawValue);
            const values = wanted.get(facetCode) ?? new Set<string>();
            values.add(value);
            wanted.set(facetCode, values);
            normalizedEntries.push({ facet: facetLabel, value });
        }

        const stored = await this.loadStoredProduct(ctx, productId);
        const managedCodes = new Set<string>(FILTER_FACETS.map(facet => facet.code));
        const keptIds = stored.facetValues
            .filter(facetValue => !managedCodes.has(facetValue.facetCode))
            .map(facetValue => facetValue.id);
        const filterValueIds: ID[] = [];

        for (const [facetCode, values] of wanted) {
            const facet = await this.facetService.findByCode(ctx, facetCode, LanguageCode.cs);
            if (!facet) {
                throw new Error(`Filtr ${facetCode} neexistuje.`);
            }
            for (const value of values) {
                const facetValue = await this.findOrCreateValue(ctx, facet, facetCode, value);
                filterValueIds.push(facetValue.id);
            }
        }

        let facetValueIds = entries
            ? [...keptIds, ...filterValueIds]
            : stored.facetValues.map(facetValue => facetValue.id);
        const customFields: {
            filterEntries?: Array<{ facet: string; value: string }>;
            parameters?: Array<{ name: string; value: string }>;
        } = {};
        if (entries) {
            customFields.filterEntries = normalizedEntries;
        }
        if (catalog) {
            if (catalog.brandProvided) {
                facetValueIds = await this.applyBrandFacet(ctx, stored.facetValues, facetValueIds, catalog.brand);
            }
            customFields.parameters = specificationRows(catalog, stored);
        }
        if (flags) {
            facetValueIds = await this.applyLabelFacets(ctx, stored.facetValues, facetValueIds, flags);
        }

        await this.productService.update(ctx, {
            id: productId,
            ...(entries || catalog?.brandProvided || flags ? { facetValueIds } : {}),
            ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
        });

        if (catalog?.weightProvided && catalog.weightKg != null && catalog.weightKg > 0 && stored.variantIds.length > 0) {
            const weightKg = catalog.weightKg;
            await this.productVariantService.update(
                ctx,
                stored.variantIds.map(id => ({
                    id,
                    customFields: { weightKg },
                })),
            );
        }
    }

    private async loadStoredProduct(ctx: RequestContext, productId: ID): Promise<StoredProduct> {
        const postgres = this.connection.rawConnection.options.type === 'postgres';
        const productSql = postgres
            ? `SELECT "customFieldsBrand" AS brand, "customFieldsSeries" AS series, "customFieldsWarranty" AS warranty,
                      "customFieldsWeightkg" AS "weightKg", "customFieldsParameters" AS parameters
               FROM "product" WHERE id = $1`
            : `SELECT customFieldsBrand AS brand, customFieldsSeries AS series, customFieldsWarranty AS warranty,
                      customFieldsWeightkg AS weightKg, customFieldsParameters AS parameters
               FROM product WHERE id = ?`;
        const facetSql = postgres
            ? `SELECT link."facetValueId" AS id, facet.code AS "facetCode", facet_value.code AS "valueCode"
               FROM "product_facet_values_facet_value" link
               INNER JOIN "facet_value" ON "facet_value".id = link."facetValueId"
               INNER JOIN "facet" ON "facet".id = "facet_value"."facetId"
               WHERE link."productId" = $1`
            : `SELECT link.facetValueId AS id, facet.code AS facetCode, facet_value.code AS valueCode
               FROM product_facet_values_facet_value link
               INNER JOIN facet_value ON facet_value.id = link.facetValueId
               INNER JOIN facet ON facet.id = facet_value.facetId
               WHERE link.productId = ?`;
        const variantSql = postgres
            ? `SELECT id FROM "product_variant" WHERE "productId" = $1 AND "deletedAt" IS NULL`
            : `SELECT id FROM product_variant WHERE productId = ? AND deletedAt IS NULL`;
        const [productRow] = await this.dbQuery<StoredProductRow>(ctx, productSql, [productId]);
        const facetValues = await this.dbQuery<StoredFacetValue>(ctx, facetSql, [productId]);
        const variants = await this.dbQuery<{ id: ID }>(ctx, variantSql, [productId]);
        return {
            brand: textValue(productRow?.brand),
            series: textValue(productRow?.series),
            warranty: textValue(productRow?.warranty),
            weightKg: weightValue(productRow?.weightKg),
            parameters: parseParameters(productRow?.parameters),
            facetValues,
            variantIds: variants.map(variant => variant.id),
        };
    }

    private dbQuery<T>(ctx: RequestContext, sql: string, params: unknown[]): Promise<T[]> {
        return this.connection.getRepository(ctx, Product).manager.query(sql, params);
    }

    private async applyBrandFacet(
        ctx: RequestContext,
        currentFacetValues: StoredFacetValue[],
        facetValueIds: ID[],
        brand: string,
    ): Promise<ID[]> {
        const knownBrandIds = new Set(
            currentFacetValues
                .filter(facetValue => facetValue.facetCode === BRAND_FACET_CODE)
                .map(facetValue => String(facetValue.id)),
        );
        const withoutBrand = facetValueIds.filter(id => !knownBrandIds.has(String(id)));
        if (!brand) {
            return withoutBrand;
        }
        const facet = await this.facetService.findByCode(ctx, BRAND_FACET_CODE, LanguageCode.cs);
        if (!facet) {
            throw new Error('Faceta brand neexistuje.');
        }
        const facetValue = await this.findOrCreateValue(ctx, facet, BRAND_FACET_CODE, brand);
        return [...withoutBrand, facetValue.id];
    }

    private async applyLabelFacets(
        ctx: RequestContext,
        currentFacetValues: StoredFacetValue[],
        facetValueIds: ID[],
        flags: LabelFlags,
    ): Promise<ID[]> {
        const facet = await this.facetService.findByCode(ctx, LABEL_FACET_CODE, LanguageCode.cs);
        if (!facet) {
            throw new Error('Faceta stitky neexistuje.');
        }
        let ids = facetValueIds;
        if (flags.isNewProvided) {
            ids = await this.setLabelValue(ctx, facet, currentFacetValues, ids, 'novinka', flags.isNew);
        }
        if (flags.onSaleProvided) {
            ids = await this.setLabelValue(ctx, facet, currentFacetValues, ids, 'akce', flags.onSale);
        }
        return ids;
    }

    private async setLabelValue(
        ctx: RequestContext,
        facet: Translated<Facet>,
        currentFacetValues: StoredFacetValue[],
        facetValueIds: ID[],
        valueCode: string,
        enabled: boolean,
    ): Promise<ID[]> {
        const knownIds = new Set(
            currentFacetValues
                .filter(facetValue => facetValue.facetCode === LABEL_FACET_CODE && facetValue.valueCode === valueCode)
                .map(facetValue => String(facetValue.id)),
        );
        const withoutLabel = facetValueIds.filter(id => !knownIds.has(String(id)));
        if (!enabled) {
            return withoutLabel;
        }
        const existing = await this.facetValueService.findByFacetId(ctx, facet.id);
        const match = existing.find(facetValue => facetValue.code === valueCode);
        if (!match) {
            throw new Error(`Hodnota štítku ${valueCode} neexistuje.`);
        }
        return [...withoutLabel, match.id];
    }

    private async findOrCreateValue(
        ctx: RequestContext,
        facet: Translated<Facet>,
        facetCode: string,
        value: string,
    ): Promise<Translated<FacetValue>> {
        const existing = await this.facetValueService.findByFacetId(ctx, facet.id);
        const match = existing.find(facetValue => facetValuesMatch(facetCode, facetValue.name, value));
        if (match) {
            if (DIMENSION_FACET_CODES.has(facetCode) && match.name !== value) {
                return this.facetValueService.update(ctx, {
                    id: match.id,
                    translations: [
                        { languageCode: LanguageCode.cs, name: value },
                        { languageCode: LanguageCode.en, name: value },
                    ],
                });
            }
            return match;
        }
        return this.facetValueService.create(ctx, facet, {
            code: facetValueCode(facetCode, value),
            translations: [
                { languageCode: LanguageCode.cs, name: value },
                { languageCode: LanguageCode.en, name: value },
            ],
        });
    }
}

function normalizeFilterValue(facetCode: string, value: string): string {
    if (!DIMENSION_FACET_CODES.has(facetCode)) {
        return value;
    }
    const millimeters = parseDimensionMillimeters(value);
    if (millimeters == null) {
        throw new Error(`Rozměr ${facetCode} musí být celé číslo v milimetrech, bez jednotky.`);
    }
    return String(millimeters);
}

function parseDimensionMillimeters(value: string): number | null {
    const match = value.trim().replace(/\s+/g, '').match(/^(\d+)(?:mm)?$/i);
    if (!match) {
        return null;
    }
    const millimeters = Number(match[1]);
    return Number.isSafeInteger(millimeters) ? millimeters : null;
}

function facetValuesMatch(facetCode: string, existingName: string, wantedValue: string): boolean {
    if (DIMENSION_FACET_CODES.has(facetCode)) {
        return parseDimensionMillimeters(existingName) === parseDimensionMillimeters(wantedValue);
    }
    return existingName.trim().toLowerCase() === wantedValue.toLowerCase();
}

function resolveFacetCode(raw: string): string | undefined {
    const trimmed = raw.trim().toLowerCase();
    return FILTER_FACETS.find(facet =>
        facet.code === trimmed
        || facet.nameCs.toLowerCase() === trimmed
        || facet.nameEn.toLowerCase() === trimmed,
    )?.code;
}

type ParameterRow = { name?: string | null; value?: string | null };

type CatalogFields = {
    brand: string;
    series: string;
    warranty: string;
    weightKg: number | null;
    brandProvided: boolean;
    seriesProvided: boolean;
    warrantyProvided: boolean;
    weightProvided: boolean;
    parameters: ParameterRow[] | null;
};

function readCustomFields(input: ProductEvent['input']): Record<string, unknown> | undefined {
    if (!input || typeof input !== 'object' || !('customFields' in input) || !input.customFields) {
        return undefined;
    }
    return input.customFields as Record<string, unknown>;
}

function readCatalogFields(input: ProductEvent['input']): CatalogFields | undefined {
    const customFields = readCustomFields(input);
    if (!customFields) {
        return undefined;
    }
    const formSubmitted = Array.isArray(customFields.parameters);
    const brand = readOptionalText(customFields, 'brand', formSubmitted);
    const series = readOptionalText(customFields, 'series', formSubmitted);
    const warranty = readOptionalText(customFields, 'warranty', formSubmitted);
    const weight = readOptionalWeight(customFields, formSubmitted);
    const parameters = formSubmitted ? (customFields.parameters as ParameterRow[]) : null;
    if (!brand.provided && !series.provided && !warranty.provided && !weight.provided && !formSubmitted) {
        return undefined;
    }
    return {
        brand: brand.value,
        series: series.value,
        warranty: warranty.value,
        weightKg: weight.value,
        brandProvided: brand.provided,
        seriesProvided: series.provided,
        warrantyProvided: warranty.provided,
        weightProvided: weight.provided,
        parameters,
    };
}

function readOptionalText(
    customFields: Record<string, unknown>,
    key: string,
    emptyNullCounts: boolean,
): { provided: boolean; value: string } {
    if (!Object.prototype.hasOwnProperty.call(customFields, key)) {
        return { provided: false, value: '' };
    }
    const value = customFields[key];
    if (value == null) {
        return { provided: emptyNullCounts, value: '' };
    }
    return { provided: true, value: textValue(value) };
}

function readOptionalWeight(
    customFields: Record<string, unknown>,
    emptyNullCounts: boolean,
): { provided: boolean; value: number | null } {
    if (!Object.prototype.hasOwnProperty.call(customFields, 'weightKg')) {
        return { provided: false, value: null };
    }
    const value = customFields.weightKg;
    if (value == null) {
        return { provided: emptyNullCounts, value: null };
    }
    return { provided: true, value: weightValue(value) };
}

function textValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function weightValue(value: unknown): number | null {
    const numeric = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (typeof numeric !== 'number' || !Number.isFinite(numeric) || numeric <= 0) {
        return null;
    }
    return numeric;
}

function parseParameters(value: unknown): ParameterRow[] {
    let parsed = value;
    if (typeof value === 'string' && value.trim() !== '') {
        parsed = JSON.parse(value) as unknown;
    }
    return Array.isArray(parsed) ? parsed : [];
}

type StoredFacetValue = { id: ID; facetCode: string; valueCode: string };

type LabelFlags = {
    isNew: boolean;
    onSale: boolean;
    isNewProvided: boolean;
    onSaleProvided: boolean;
};

function readLabelFlags(input: ProductEvent['input']): LabelFlags | undefined {
    const customFields = readCustomFields(input);
    if (!customFields) {
        return undefined;
    }
    const isNew = readOptionalBoolean(customFields, 'isNew');
    const onSale = readOptionalBoolean(customFields, 'onSale');
    if (!isNew.provided && !onSale.provided) {
        return undefined;
    }
    return {
        isNew: isNew.value,
        onSale: onSale.value,
        isNewProvided: isNew.provided,
        onSaleProvided: onSale.provided,
    };
}

function readOptionalBoolean(
    customFields: Record<string, unknown>,
    key: string,
): { provided: boolean; value: boolean } {
    if (!Object.prototype.hasOwnProperty.call(customFields, key)) {
        return { provided: false, value: false };
    }
    return { provided: true, value: customFields[key] === true };
}

type StoredProductRow = {
    brand?: string | null;
    series?: string | null;
    warranty?: string | null;
    weightKg?: number | string | null;
    parameters?: string | ParameterRow[] | null;
};

type StoredProduct = {
    brand: string;
    series: string;
    warranty: string;
    weightKg: number | null;
    parameters: ParameterRow[];
    facetValues: StoredFacetValue[];
    variantIds: ID[];
};

function specificationRows(catalog: CatalogFields, stored: StoredProduct): Array<{ name: string; value: string }> {
    const source = catalog.parameters ?? stored.parameters;
    const superiorKeys = new Set<string>(SUPERIOR_PARAMETERS.flatMap(item => [...item.keys]));
    const rest = source.flatMap(row => {
        const name = row?.name?.trim() ?? '';
        const value = row?.value?.trim() ?? '';
        if ((!name && !value) || superiorKeys.has(normalizeParameterName(name))) {
            return [];
        }
        return [{ name, value }];
    });
    const brand = catalog.brandProvided ? catalog.brand : stored.brand;
    const series = catalog.seriesProvided ? catalog.series : stored.series;
    const warranty = catalog.warrantyProvided ? catalog.warranty : stored.warranty;
    const head = [
        { name: 'Značka', value: brand },
        { name: 'Série', value: series },
        { name: 'Záruka', value: warranty },
    ].filter(row => row.value.length > 0);
    return [...head, ...rest];
}

function normalizeParameterName(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/[áäčďéěíňóřšťúůýž]/g, character => diacritics[character] ?? character);
}

function readFilterEntries(input: ProductEvent['input']): FilterEntry[] | undefined {
    if (!input || typeof input !== 'object' || !('customFields' in input)) {
        return undefined;
    }
    const customFields = input.customFields as { filterEntries?: FilterEntry[] | null } | null | undefined;
    if (!customFields || !Object.prototype.hasOwnProperty.call(customFields, 'filterEntries') || customFields.filterEntries == null) {
        return undefined;
    }
    return customFields.filterEntries;
}

function facetValueCode(facetCode: string, value: string): string {
    const slug = value
        .toLowerCase()
        .replace(/[áäčďéěíňóřšťúůýž]/g, character => diacritics[character] ?? character)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `${facetCode}-${slug || 'hodnota'}`.slice(0, 255);
}
