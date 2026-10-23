import { Injectable, OnModuleInit } from '@nestjs/common';
import {
    Collection,
    CollectionService,
    EventBus,
    ID,
    idsAreEqual,
    Logger,
    ProductEvent,
    ProductService,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

const PRODUCT_FILTER_CODE = 'product-id-filter';

type FilterArgument = { name: string; value: string };

type StoredFilter = { code: string; args: FilterArgument[] };

type CategoryAssignment = {
    categories: string[] | null;
    primaryId: string | null;
};

@Injectable()
export class ProductCategoryAssignmentService implements OnModuleInit {
    private readonly syncingProductIds = new Set<string>();

    constructor(
        private readonly eventBus: EventBus,
        private readonly connection: TransactionalConnection,
        private readonly collectionService: CollectionService,
        private readonly productService: ProductService,
    ) {}

    onModuleInit() {
        this.eventBus.registerBlockingEventHandler({
            event: ProductEvent,
            id: 'sync-product-categories',
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
        const assignment = readAssignment(event.input);
        if (!assignment) {
            return;
        }
        this.syncingProductIds.add(productId);
        try {
            await this.sync(event.ctx, productId, assignment);
        } catch (error) {
            Logger.error(
                `Kategorie produktu ${productId} se nepodařilo uložit: ${error instanceof Error ? error.message : String(error)}`,
                'ProductCategoryAssignment',
            );
            throw error;
        } finally {
            this.syncingProductIds.delete(productId);
        }
    }

    private async sync(ctx: RequestContext, productId: string, assignment: CategoryAssignment) {
        const collections = await this.connection.getRepository(ctx, Collection).find();
        const byId = new Map(collections.map(collection => [String(collection.id), collection]));
        const current = new Set<string>();
        for (const collection of collections) {
            if (collection.isRoot) {
                continue;
            }
            if (productIds(collection).includes(productId)) {
                current.add(String(collection.id));
            }
        }

        const desired = new Set(assignment.categories ?? [...current]);
        if (assignment.primaryId) {
            desired.add(assignment.primaryId);
        }
        for (const collectionId of [...desired]) {
            const collection = byId.get(collectionId);
            if (!collection || collection.isRoot) {
                desired.delete(collectionId);
            }
        }

        for (const collection of collections) {
            if (collection.isRoot) {
                continue;
            }
            const collectionId = String(collection.id);
            const filters = storedFilters(collection);
            const productFilter = filters.find(filter => filter.code === PRODUCT_FILTER_CODE);
            const ids = productFilter ? readProductIds(productFilter) : [];
            const includesProduct = ids.includes(productId);
            const shouldInclude = desired.has(collectionId);
            if (includesProduct === shouldInclude) {
                continue;
            }
            const nextIds = shouldInclude
                ? [...ids.filter(id => id !== productId), productId]
                : ids.filter(id => id !== productId);
            const nextFilters = nextIds.length === 0
                ? filters.filter(filter => filter.code !== PRODUCT_FILTER_CODE)
                : upsertProductFilter(filters, nextIds);
            await this.collectionService.update(ctx, {
                id: collection.id,
                filters: nextFilters.map(filter => ({
                    code: filter.code,
                    arguments: filter.args,
                })),
            });
        }

        if (assignment.categories && assignment.primaryId && !assignment.categories.some(id => idsAreEqual(id, assignment.primaryId))) {
            await this.productService.update(ctx, {
                id: productId,
                customFields: { categoriesIds: [...desired] },
            });
        } else if (assignment.categories === null && assignment.primaryId) {
            const relationIds = await this.categoryRelationIds(ctx, productId);
            if (!relationIds.some(id => idsAreEqual(id, assignment.primaryId))) {
                await this.productService.update(ctx, {
                    id: productId,
                    customFields: { categoriesIds: [...relationIds, assignment.primaryId] },
                });
            }
        }
    }

    private async categoryRelationIds(ctx: RequestContext, productId: string): Promise<string[]> {
        const postgres = this.connection.rawConnection.options.type === 'postgres';
        const sql = postgres
            ? `SELECT "collectionId" AS id FROM "product_custom_fields_categories_collection" WHERE "productId" = $1`
            : `SELECT collectionId AS id FROM product_custom_fields_categories_collection WHERE productId = ?`;
        const rows: Array<{ id: ID }> = await this.connection.getRepository(ctx, Collection).manager.query(sql, [productId]);
        return rows.map(row => String(row.id));
    }
}

function readAssignment(input: ProductEvent['input']): CategoryAssignment | undefined {
    if (!input || typeof input !== 'object' || !('customFields' in input) || !input.customFields) {
        return undefined;
    }
    const customFields = input.customFields as {
        categoriesIds?: Array<ID | null> | null;
        primaryCategoryId?: ID | null;
    };
    const categoriesProvided = Object.prototype.hasOwnProperty.call(customFields, 'categoriesIds')
        && Array.isArray(customFields.categoriesIds);
    const primaryProvided = Object.prototype.hasOwnProperty.call(customFields, 'primaryCategoryId')
        && (customFields.primaryCategoryId != null || categoriesProvided);
    if (!categoriesProvided && !primaryProvided) {
        return undefined;
    }
    return {
        categories: categoriesProvided
            ? (customFields.categoriesIds ?? []).flatMap(id => id == null ? [] : [String(id)])
            : null,
        primaryId: customFields.primaryCategoryId == null ? null : String(customFields.primaryCategoryId),
    };
}

function storedFilters(collection: Collection): StoredFilter[] {
    const filters = collection.filters as StoredFilter[] | string | null | undefined;
    if (Array.isArray(filters)) {
        return filters;
    }
    if (typeof filters === 'string' && filters.trim()) {
        const parsed = JSON.parse(filters) as StoredFilter[];
        return Array.isArray(parsed) ? parsed : [];
    }
    return [];
}

function productIds(collection: Collection): string[] {
    const filter = storedFilters(collection).find(item => item.code === PRODUCT_FILTER_CODE);
    return filter ? readProductIds(filter) : [];
}

function readProductIds(filter: StoredFilter): string[] {
    const raw = filter.args.find(argument => argument.name === 'productIds')?.value ?? '[]';
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(id => String(id)) : [];
}

function upsertProductFilter(filters: StoredFilter[], productIdsToStore: string[]): StoredFilter[] {
    const nextFilter: StoredFilter = {
        code: PRODUCT_FILTER_CODE,
        args: [
            { name: 'productIds', value: JSON.stringify(productIdsToStore) },
            {
                name: 'combineWithAnd',
                value: filters.some(filter => filter.code !== PRODUCT_FILTER_CODE) ? 'false' : 'true',
            },
        ],
    };
    const withoutProductFilter = filters.filter(filter => filter.code !== PRODUCT_FILTER_CODE);
    return [...withoutProductFilter, nextFilter];
}

function sameIds(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
        return false;
    }
    return left.every(id => right.some(other => idsAreEqual(id, other)));
}
