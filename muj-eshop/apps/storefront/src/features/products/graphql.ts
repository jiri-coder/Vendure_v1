import {graphql} from '@/platform/vendure/graphql';

export const ProductCardFragment = graphql(`
    fragment ProductCard on SearchResult {
        productId
        productName
        slug
        productAsset {
            id
            preview
        }
        priceWithTax {
            __typename
            ... on PriceRange {
                min
                max
            }
            ... on SinglePrice {
                value
            }
        }
        currencyCode
        facetValueIds
    }
`);

export const GetProductDetailQuery = graphql(`
    query GetProductDetail($slug: String!) {
        product(slug: $slug) {
            id
            name
            description
            slug
            featuredAsset {
                id
                preview
                source
            }
            assets {
                id
                preview
                source
            }
            customFields {
                brand
                series
                isNew
                onSale
                availability
                videos
                relatedProducts {
                    id
                    name
                    slug
                    enabled
                    featuredAsset {
                        id
                        preview
                    }
                    customFields {
                        availability
                    }
                    variants {
                        id
                        priceWithTax
                        currencyCode
                        stockLevel
                    }
                }
                parameters {
                    name
                    value
                }
                downloads {
                    id
                    name
                    source
                    preview
                    mimeType
                }
                primaryCategory {
                    id
                    name
                    slug
                    breadcrumbs {
                        id
                        name
                        slug
                    }
                }
            }
            variants {
                id
                name
                sku
                priceWithTax
                stockLevel
                featuredAsset {
                    id
                    preview
                    source
                }
                assets {
                    id
                    preview
                    source
                }
                customFields {
                    ean
                    recommendedPrice
                    availability
                    parameters {
                        name
                        value
                    }
                }
                options {
                    id
                    code
                    name
                    groupId
                    group {
                        id
                        code
                        name
                    }
                }
            }
            optionGroups {
                id
                code
                name
                options {
                    id
                    code
                    name
                }
            }
            collections {
                id
                name
                slug
                parent {
                    id
                }
            }
        }
    }
`);

export const GetProductAccessoriesQuery = graphql(`
    query GetProductAccessories($slug: String!) {
        product(slug: $slug) {
            id
            customFields {
                relatedProducts {
                    id
                    name
                    slug
                    enabled
                    featuredAsset {
                        id
                        preview
                    }
                    customFields {
                        availability
                    }
                    variants {
                        id
                        priceWithTax
                        currencyCode
                        stockLevel
                    }
                }
            }
        }
    }
`);

export const GetAdvancePaymentOfferQuery = graphql(`
    query GetAdvancePaymentOffer {
        advancePaymentOffer {
            percentageRate
            fixedFee
        }
    }
`);

export const ProductsByAttributeQuery = graphql(`
    query ProductsByAttribute($options: ProductListOptions) {
        products(options: $options) {
            totalItems
            items {
                id
                name
                slug
                featuredAsset {
                    id
                    preview
                }
                variants {
                    id
                    priceWithTax
                    currencyCode
                }
            }
        }
    }
`);
