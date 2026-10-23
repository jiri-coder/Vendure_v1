import {
    bootstrapWorker,
    Collection,
    CollectionService,
    ConfigService,
    LanguageCode,
    RequestContextService,
    TransactionalConnection,
    User,
} from '@vendure/core';
import { bathroomCatalog, CatalogNode } from './bathroom-catalog';
import { config } from './vendure-config';

function translations(node: CatalogNode) {
    return [LanguageCode.cs, LanguageCode.en].map(languageCode => ({
        languageCode,
        name: node.name,
        slug: node.slug,
        description: node.description,
    }));
}

function catalogSlugs(nodes: CatalogNode[], slugs = new Set<string>()) {
    for (const node of nodes) {
        slugs.add(node.slug);
        catalogSlugs(node.children, slugs);
    }
    return slugs;
}

async function ensureNode(
    collectionService: CollectionService,
    ctx: Awaited<ReturnType<RequestContextService['create']>>,
    node: CatalogNode,
    parentId: string | number,
) {
    const existing = await collectionService.findOneBySlug(ctx, node.slug);
    const collection = existing ?? await collectionService.create(ctx, {
        parentId,
        filters: [],
        inheritFilters: false,
        isPrivate: false,
        translations: translations(node),
    });

    if (
        existing &&
        (existing.name !== node.name || existing.description !== node.description || existing.isPrivate)
    ) {
        await collectionService.update(ctx, {
            id: existing.id,
            isPrivate: false,
            translations: translations(node),
        });
    }

    for (const child of node.children) {
        await ensureNode(collectionService, ctx, child, collection.id);
    }
}

async function orderNodes(
    collectionService: CollectionService,
    ctx: Awaited<ReturnType<RequestContextService['create']>>,
    nodes: CatalogNode[],
    parentId: string | number,
) {
    for (const [index, node] of nodes.entries()) {
        const collection = await collectionService.findOneBySlug(ctx, node.slug);
        if (!collection) {
            throw new Error(`Kolekce ${node.slug} nebyla vytvořena.`);
        }
        await collectionService.move(ctx, {
            collectionId: collection.id,
            parentId,
            index,
        });
        await orderNodes(collectionService, ctx, node.children, collection.id);
    }
}

async function configureCatalog() {
    const worker = await bootstrapWorker(config);
    try {
        const configService = worker.app.get(ConfigService);
        const connection = worker.app.get(TransactionalConnection);
        const requestContextService = worker.app.get(RequestContextService);
        const collectionService = worker.app.get(CollectionService);
        const superadmin = await connection.rawConnection.getRepository(User).findOneOrFail({
            where: {
                identifier: configService.authOptions.superadminCredentials.identifier,
            },
            relations: {
                roles: {
                    channels: true,
                },
            },
        });
        const ctx = await requestContextService.create({
            apiType: 'admin',
            user: superadmin,
            languageCode: LanguageCode.cs,
        });
        const root = await connection.getRepository(ctx, Collection).findOneOrFail({
            where: { isRoot: true },
        });

        for (const node of bathroomCatalog) {
            await ensureNode(collectionService, ctx, node, root.id);
        }
        await orderNodes(collectionService, ctx, bathroomCatalog, root.id);

        const wanted = catalogSlugs(bathroomCatalog);
        const descendants = await collectionService.getDescendants(ctx, root.id);
        const parentIds = new Map(descendants.map(collection => [String(collection.id), collection.parentId]));
        const depthOf = (id: string | number) => {
            let depth = 0;
            let parentId = parentIds.get(String(id));
            const seen = new Set<string>();
            while (parentId && !seen.has(String(parentId))) {
                seen.add(String(parentId));
                depth++;
                parentId = parentIds.get(String(parentId));
            }
            return depth;
        };
        const obsolete = descendants
            .filter(collection => !wanted.has(collection.slug))
            .sort((left, right) => depthOf(right.id) - depthOf(left.id));

        for (const collection of obsolete) {
            const result = await collectionService.delete(ctx, collection.id);
            if (result.result === 'DELETED') {
                console.log(`Odebráno: ${collection.slug}`);
            } else {
                await collectionService.update(ctx, { id: collection.id, isPrivate: true });
                console.log(`Skryto: ${collection.slug}`);
            }
        }

        console.log('Katalog koupelen je připraven.');
    } finally {
        await worker.app.close();
    }
}

configureCatalog().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
