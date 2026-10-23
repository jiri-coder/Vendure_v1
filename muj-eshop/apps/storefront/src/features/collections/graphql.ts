import {graphql} from '@/platform/vendure/graphql';
import {ProductCardFragment} from '@/features/products/graphql';

export const GetTopCollectionsQuery = graphql(`
    query GetTopCollections {
        collections(options: { take: 100, sort: { position: ASC }, filter: { parentId: { eq: "1" } } }) {
            items {
                id
                name
                slug
                position
                featuredAsset {
                    preview
                }
                children {
                    id
                    name
                    slug
                    position
                    children {
                        id
                        name
                        slug
                        position
                    }
                }
            }
        }
    }
`);

export const GetCollectionProductsQuery = graphql(`
    query GetCollectionProducts($slug: String!, $input: SearchInput!) {
        collection(slug: $slug) {
            id
            name
            slug
            description
            breadcrumbs {
                id
                name
                slug
            }
            featuredAsset {
                id
                preview
            }
            customFields {
                filterFacets {
                    code
                }
            }
            children {
                id
                name
                slug
                position
                featuredAsset {
                    preview
                }
                children {
                    id
                    name
                    slug
                    position
                }
            }
            parent {
                customFields {
                    filterFacets {
                        code
                    }
                }
                parent {
                    customFields {
                        filterFacets {
                            code
                        }
                    }
                    parent {
                        customFields {
                            filterFacets {
                                code
                            }
                        }
                    }
                }
            }
        }
        search(input: $input) {
            totalItems
            items {
                ...ProductCard
            }
        }
    }
`, [ProductCardFragment]);

type CollectionFilterSource = {
    customFields?: { filterFacets: Array<{ code: string }> } | null;
    parent?: CollectionFilterSource | null;
} | null | undefined;

export function collectionFilterFacetCodes(collection: CollectionFilterSource): string[] {
    let current = collection;
    while (current) {
        const codes = (current.customFields?.filterFacets ?? [])
            .map(facet => facet.code)
            .filter(code => code.length > 0);
        if (codes.length > 0) {
            return codes;
        }
        current = current.parent;
    }
    return [];
}
