import {
    Asset,
    Collection,
    Facet,
    LanguageCode,
    PaymentMethod,
    Product,
    PaymentMethodEligibilityChecker,
    PluginCommonModule,
    ShippingEligibilityChecker,
    VendurePlugin,
} from '@vendure/core';
import {
    BankTransferInstructionsResolver,
    bankTransferShopApiExtensions,
} from './bank-transfer-instructions';
import {
    PaymentPricingShopResolver,
    paymentPricingShopApiExtensions,
} from './payment-pricing';
import { gql } from 'graphql-tag';
import { czechTieredShippingCalculator } from './shipping-calculator';
import { FilterFacetService, FILTER_FACETS } from './filter-facets';
import { PaymentAdjustmentInvalidationService } from './payment-adjustment-invalidation.service';
import { ProductCategoryAssignmentService } from './product-category-assignment.service';
import { ProductFilterEntryService } from './product-filter-entries.service';
import { merchandisePercentageDiscount } from './merchandise-percentage-promotion';
import { sanitizeCustomFieldRelationInputs } from './sanitize-custom-field-relation-inputs';
import { NumericStockDisplayStrategy } from './stock-display-strategy';
import { ShippingPaymentRestrictionService } from './shipping-payment-restriction.service';
import { OrderHasNoteResolver, orderHasNoteAdminApiExtensions } from './order-has-note';
import { ShopInvoice, ShopInvoiceLine } from './invoice-entities';
import { InvoiceService } from './invoice.service';
import {
    ShopInvoiceAdminResolver,
    ShopInvoiceOrderResolver,
    ShopInvoiceShopResolver,
    shopInvoiceAdminApiExtensions,
    shopInvoiceShopApiExtensions,
} from './invoice.resolver';
import {
    AllocationOrderLineResolver,
    CancellationOrderLineResolver,
    ReleaseOrderLineResolver,
    SaleOrderLineResolver,
    StockLedgerOriginService,
} from './stock-ledger';

export const PAYMENT_TYPES = {
    ONLINE_CARD: 'ONLINE_CARD',
    BANK_TRANSFER: 'BANK_TRANSFER',
    COD: 'COD',
    PAY_AT_PICKUP: 'PAY_AT_PICKUP',
} as const;

export const DELIVERY_TYPES = {
    HOME_DELIVERY: 'HOME_DELIVERY',
    PICKUP_POINT: 'PICKUP_POINT',
    PERSONAL_PICKUP: 'PERSONAL_PICKUP',
} as const;

export const AVAILABILITY_STATUSES = {
    IN_STOCK: 'IN_STOCK',
    SUPPLIER_24H: 'SUPPLIER_24H',
    SUPPLIER_3D: 'SUPPLIER_3D',
    STOCK_4_8D: 'STOCK_4_8D',
    STOCK_1_2W: 'STOCK_1_2W',
    USUALLY_14D: 'USUALLY_14D',
    USUALLY_30D: 'USUALLY_30D',
    ON_REQUEST: 'ON_REQUEST',
    SOLD_OUT: 'SOLD_OUT',
} as const;

export const SHIPPING_PROFILES = {
    STANDARD: 'STANDARD',
    HOME_DELIVERY_ONLY: 'HOME_DELIVERY_ONLY',
    PICKUP_POINT_ONLY: 'PICKUP_POINT_ONLY',
    PERSONAL_PICKUP_ONLY: 'PERSONAL_PICKUP_ONLY',
    NO_PICKUP_POINT: 'NO_PICKUP_POINT',
} as const;

type DeliveryType = (typeof DELIVERY_TYPES)[keyof typeof DELIVERY_TYPES];
type ShippingProfile = (typeof SHIPPING_PROFILES)[keyof typeof SHIPPING_PROFILES];

function option(value: string, cs: string, en: string) {
    return {
        value,
        label: [
            { languageCode: LanguageCode.cs, value: cs },
            { languageCode: LanguageCode.en, value: en },
        ],
    };
}

function availabilitySelectOptions() {
    return [
        option(AVAILABILITY_STATUSES.IN_STOCK, 'Skladem - ihned k odběru', 'In stock — ready for pickup'),
        option(AVAILABILITY_STATUSES.SUPPLIER_24H, 'Skladem u dodavatele (odeslání do 24 hodin)', 'At the supplier (dispatch within 24 hours)'),
        option(AVAILABILITY_STATUSES.SUPPLIER_3D, 'Skladem u dodavatele (odeslání do 3 dnů)', 'At the supplier (dispatch within 3 days)'),
        option(AVAILABILITY_STATUSES.STOCK_4_8D, 'Skladem do 4–8 dnů', 'In stock within 4–8 days'),
        option(AVAILABILITY_STATUSES.STOCK_1_2W, 'Skladem do 1–2 týdnů', 'In stock within 1–2 weeks'),
        option(AVAILABILITY_STATUSES.USUALLY_14D, 'Obvykle do 14 dnů', 'Usually within 14 days'),
        option(AVAILABILITY_STATUSES.USUALLY_30D, 'Obvykle do 30 dnů', 'Usually within 30 days'),
        option(AVAILABILITY_STATUSES.ON_REQUEST, 'Na dotaz', 'On request'),
        option(AVAILABILITY_STATUSES.SOLD_OUT, 'Vyprodáno', 'Sold out'),
    ];
}

function productVariantField(orderLine: unknown, fieldName: string): string | undefined {
    const line = orderLine as {
        productVariant?: { customFields?: Record<string, unknown> };
    };
    const value = line.productVariant?.customFields?.[fieldName];
    return typeof value === 'string' ? value : undefined;
}

function orderMerchandiseTotal(order: {
    lines: Array<{ proratedLinePriceWithTax: number }>;
}): number {
    return order.lines.reduce((total, line) => total + line.proratedLinePriceWithTax, 0);
}

function orderWeightKg(order: unknown): number {
    const typedOrder = order as {
        lines: Array<{
        quantity: number;
        productVariant?: { customFields?: Record<string, unknown> };
        }>;
    };
    return typedOrder.lines.reduce((total, line) => {
        const value = Number(line.productVariant?.customFields?.weightKg ?? 0);
        const unitWeight = Number.isFinite(value) && value > 0 ? value : 0;
        return total + unitWeight * line.quantity;
    }, 0);
}

function selectedDeliveryTypes(order: unknown): DeliveryType[] {
    const typedOrder = order as {
        shippingLines?: Array<{
            shippingMethod?: { customFields?: Record<string, unknown> };
        }>;
    };
    return (typedOrder.shippingLines ?? [])
        .map(line => line.shippingMethod?.customFields?.deliveryType)
        .filter((value): value is DeliveryType =>
            typeof value === 'string' &&
            Object.values(DELIVERY_TYPES).includes(value as DeliveryType),
        );
}

function hasPickupPoint(order: unknown): boolean {
    const typedOrder = order as { customFields?: Record<string, unknown> };
    return Boolean(
        typedOrder.customFields?.pickupPointCarrier &&
        typedOrder.customFields?.pickupPointId,
    );
}

function shippingProfileAllows(profile: ShippingProfile, deliveryType: DeliveryType): boolean {
    switch (profile) {
        case SHIPPING_PROFILES.HOME_DELIVERY_ONLY:
            return deliveryType === DELIVERY_TYPES.HOME_DELIVERY;
        case SHIPPING_PROFILES.PICKUP_POINT_ONLY:
            return deliveryType === DELIVERY_TYPES.PICKUP_POINT;
        case SHIPPING_PROFILES.PERSONAL_PICKUP_ONLY:
            return deliveryType === DELIVERY_TYPES.PERSONAL_PICKUP;
        case SHIPPING_PROFILES.NO_PICKUP_POINT:
            return deliveryType !== DELIVERY_TYPES.PICKUP_POINT;
        default:
            return true;
    }
}

export const czechShippingEligibilityChecker = new ShippingEligibilityChecker({
    code: 'czech-shipping-profile',
    description: [
        {
            languageCode: LanguageCode.cs,
            value: 'Kontroluje kompatibilitu dopravy se všemi variantami v košíku',
        },
        {
            languageCode: LanguageCode.en,
            value: 'Checks that the delivery type is compatible with every variant in the cart',
        },
    ],
    args: {
        deliveryType: {
            type: 'string',
            required: true,
            config: {
                options: [
                    option(DELIVERY_TYPES.HOME_DELIVERY, 'Kurýr na adresu', 'Home delivery'),
                    option(DELIVERY_TYPES.PICKUP_POINT, 'Výdejní místo', 'Pickup point'),
                    option(DELIVERY_TYPES.PERSONAL_PICKUP, 'Osobní odběr', 'Personal pickup'),
                ],
            },
        },
        minimumOrderSubtotal: {
            type: 'int',
            defaultValue: 0,
            ui: { component: 'currency-form-input' },
            label: [
                { languageCode: LanguageCode.cs, value: 'Minimální cena zboží' },
                { languageCode: LanguageCode.en, value: 'Minimum merchandise total' },
            ],
        },
        maximumOrderSubtotal: {
            type: 'int',
            defaultValue: 0,
            ui: { component: 'currency-form-input' },
            label: [
                { languageCode: LanguageCode.cs, value: 'Maximální cena zboží (0 = bez limitu)' },
                { languageCode: LanguageCode.en, value: 'Maximum merchandise total (0 = unlimited)' },
            ],
        },
        minimumWeightKg: {
            type: 'float',
            defaultValue: 0,
            ui: { component: 'number-form-input', suffix: ' kg', min: 0, step: 0.01 },
            label: [
                { languageCode: LanguageCode.cs, value: 'Minimální hmotnost' },
                { languageCode: LanguageCode.en, value: 'Minimum weight' },
            ],
        },
        maximumWeightKg: {
            type: 'float',
            defaultValue: 0,
            ui: { component: 'number-form-input', suffix: ' kg', min: 0, step: 0.01 },
            label: [
                { languageCode: LanguageCode.cs, value: 'Maximální hmotnost (0 = bez limitu)' },
                { languageCode: LanguageCode.en, value: 'Maximum weight (0 = unlimited)' },
            ],
        },
    },
    check: (_ctx, order, args) => {
        const profilesAllowed = order.lines.every(line => {
            const profile =
                productVariantField(line, 'shippingProfile') as ShippingProfile | undefined ??
                SHIPPING_PROFILES.STANDARD;
            return shippingProfileAllows(profile, args.deliveryType as DeliveryType);
        });
        if (!profilesAllowed) {
            return false;
        }

        const merchandiseTotal = orderMerchandiseTotal(order);
        if (merchandiseTotal < args.minimumOrderSubtotal ||
            (args.maximumOrderSubtotal > 0 && merchandiseTotal > args.maximumOrderSubtotal)) {
            return false;
        }

        const weightKg = orderWeightKg(order);
        return weightKg >= args.minimumWeightKg &&
            (args.maximumWeightKg <= 0 || weightKg <= args.maximumWeightKg);
    },
});

let shippingPaymentRestriction: ShippingPaymentRestrictionService | undefined;

export const czechPaymentEligibilityChecker = new PaymentMethodEligibilityChecker({
    code: 'czech-payment-policy',
    description: [
        {
            languageCode: LanguageCode.cs,
            value: 'Kontroluje zvolenou dopravu, limit objednávky a výdejní místo',
        },
        {
            languageCode: LanguageCode.en,
            value: 'Checks selected shipping, order limit and pickup-point selection',
        },
    ],
    args: {
        paymentType: {
            type: 'string',
            required: true,
            config: {
                options: [
                    option(PAYMENT_TYPES.ONLINE_CARD, 'Online platba', 'Online card payment'),
                    option(PAYMENT_TYPES.BANK_TRANSFER, 'Bankovní převod', 'Bank transfer'),
                    option(PAYMENT_TYPES.COD, 'Dobírka', 'Cash on delivery'),
                    option(PAYMENT_TYPES.PAY_AT_PICKUP, 'Platba při osobním odběru', 'Pay at pickup'),
                ],
            },
        },
        maximumOrderTotal: {
            type: 'int',
            required: false,
            defaultValue: 0,
            ui: { component: 'currency-form-input' },
            label: [
                { languageCode: LanguageCode.cs, value: 'Maximální hodnota objednávky (0 = bez limitu)' },
                { languageCode: LanguageCode.en, value: 'Maximum order total (0 = unlimited)' },
            ],
        },
    },
    init: injector => {
        shippingPaymentRestriction = injector.get(ShippingPaymentRestrictionService);
    },
    check: async (ctx, order, args, method) => {
        if (args.maximumOrderTotal > 0 && order.totalWithTax > args.maximumOrderTotal) {
            return 'Pro tento způsob platby byla překročena maximální hodnota objednávky.';
        }

        const allowedPaymentIds = await shippingPaymentRestriction?.allowedPaymentMethodIdsForOrder(ctx, order);
        if (allowedPaymentIds && !allowedPaymentIds.includes(String(method.id))) {
            return 'Zvolený způsob platby není dostupný pro vybranou dopravu.';
        }

        if (selectedDeliveryTypes(order).includes(DELIVERY_TYPES.PICKUP_POINT) &&
            !hasPickupPoint(order)) {
            return 'Nejdříve vyberte výdejní místo.';
        }

        return true;
    },
});

@VendurePlugin({
    compatibility: '^3.7.0',
    dashboard: './dashboard/index.tsx',
    imports: [PluginCommonModule],
    entities: [ShopInvoice, ShopInvoiceLine],
    providers: [
        PaymentAdjustmentInvalidationService,
        FilterFacetService,
        ProductFilterEntryService,
        ProductCategoryAssignmentService,
        ShippingPaymentRestrictionService,
        StockLedgerOriginService,
        InvoiceService,
    ],
    shopApiExtensions: {
        schema: gql([
            paymentPricingShopApiExtensions.loc?.source.body ?? '',
            bankTransferShopApiExtensions.loc?.source.body ?? '',
            shopInvoiceShopApiExtensions.loc?.source.body ?? '',
        ].join('\n')),
        resolvers: [
            PaymentPricingShopResolver,
            BankTransferInstructionsResolver,
            ShopInvoiceOrderResolver,
            ShopInvoiceShopResolver,
        ],
    },
    adminApiExtensions: {
        schema: gql([
            orderHasNoteAdminApiExtensions.loc?.source.body ?? '',
            shopInvoiceAdminApiExtensions.loc?.source.body ?? '',
        ].join('\n')),
        resolvers: [
            OrderHasNoteResolver,
            SaleOrderLineResolver,
            ReleaseOrderLineResolver,
            AllocationOrderLineResolver,
            CancellationOrderLineResolver,
            ShopInvoiceOrderResolver,
            ShopInvoiceAdminResolver,
        ],
    },
    configuration: config => {
        config.apiOptions.apolloServerPlugins ??= [];
        config.apiOptions.apolloServerPlugins.push({
            async requestDidStart() {
                return {
                    async didResolveSource(requestContext) {
                        sanitizeCustomFieldRelationInputs(requestContext.request.variables);
                    },
                };
            },
        });

        config.catalogOptions.stockDisplayStrategy = new NumericStockDisplayStrategy();

        config.customFields.Collection ??= [];
        config.customFields.Collection.push({
            name: 'filterFacets',
            type: 'relation',
            entity: Facet,
            list: true,
            public: true,
            label: [
                { languageCode: LanguageCode.cs, value: 'Filtry v kategorii' },
                { languageCode: LanguageCode.en, value: 'Category filters' },
            ],
            description: [
                {
                    languageCode: LanguageCode.cs,
                    value: 'Facety zobrazené jako filtry na stránce kategorie. Prázdný výběr převezme filtry nadřazené kategorie.',
                },
                {
                    languageCode: LanguageCode.en,
                    value: 'Facets shown as filters on the category page. An empty selection inherits filters from the parent category.',
                },
            ],
        });

        config.customFields.Product.push(
            {
                name: 'brand',
                type: 'string',
                nullable: true,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Značka' },
                    { languageCode: LanguageCode.en, value: 'Brand' },
                ],
                description: [
                    {
                        languageCode: LanguageCode.cs,
                        value: 'Zapíše se do specifikace a jako hodnota facety brand. Platí pro všechny varianty.',
                    },
                    {
                        languageCode: LanguageCode.en,
                        value: 'Copied into the specification and stored as a value of the brand facet. Applies to every variant.',
                    },
                ],
            },
            {
                name: 'series',
                type: 'string',
                nullable: true,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Série' },
                    { languageCode: LanguageCode.en, value: 'Series' },
                ],
                description: [
                    {
                        languageCode: LanguageCode.cs,
                        value: 'Zapíše se do specifikace. Platí pro všechny varianty.',
                    },
                    {
                        languageCode: LanguageCode.en,
                        value: 'Copied into the specification. Applies to every variant.',
                    },
                ],
            },
            {
                name: 'warranty',
                type: 'string',
                nullable: true,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Záruka' },
                    { languageCode: LanguageCode.en, value: 'Warranty' },
                ],
                description: [
                    {
                        languageCode: LanguageCode.cs,
                        value: 'Například 2 roky. Zapíše se do specifikace a platí pro všechny varianty.',
                    },
                    {
                        languageCode: LanguageCode.en,
                        value: 'For example 2 years. Copied into the specification and applies to every variant.',
                    },
                ],
            },
            {
                name: 'weightKg',
                type: 'float',
                nullable: true,
                public: true,
                ui: { component: 'number-form-input', suffix: ' kg', min: 0, step: 0.01 },
                label: [
                    { languageCode: LanguageCode.cs, value: 'Hmotnost pro dopravu' },
                    { languageCode: LanguageCode.en, value: 'Shipping weight' },
                ],
                description: [
                    {
                        languageCode: LanguageCode.cs,
                        value: 'Hmotnost pro výpočet dopravy v kilogramech. Do technické specifikace se nezapisuje. Skutečnou hmotnost od dodavatele uveďte mezi parametry. Hodnota se přenese na všechny varianty.',
                    },
                    {
                        languageCode: LanguageCode.en,
                        value: 'Weight used for shipping, in kilograms. It is not written into the specification. Put the supplier weight among the parameters. The value is copied to every variant.',
                    },
                ],
            },
            {
                name: 'isNew',
                type: 'boolean',
                defaultValue: false,
                nullable: false,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Novinka' },
                    { languageCode: LanguageCode.en, value: 'New' },
                ],
                description: [
                    {
                        languageCode: LanguageCode.cs,
                        value: 'Zobrazí štítek Novinka v katalogu a na detailu produktu.',
                    },
                    {
                        languageCode: LanguageCode.en,
                        value: 'Shows a New badge in the catalog and on the product page.',
                    },
                ],
            },
            {
                name: 'onSale',
                type: 'boolean',
                defaultValue: false,
                nullable: false,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'V akci' },
                    { languageCode: LanguageCode.en, value: 'On sale' },
                ],
                description: [
                    {
                        languageCode: LanguageCode.cs,
                        value: 'Zobrazí štítek V akci v katalogu a na detailu produktu.',
                    },
                    {
                        languageCode: LanguageCode.en,
                        value: 'Shows an On sale badge in the catalog and on the product page.',
                    },
                ],
            },
            {
                name: 'availability',
                type: 'string',
                nullable: true,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Dostupnost' },
                    { languageCode: LanguageCode.en, value: 'Availability' },
                ],
                description: [
                    {
                        languageCode: LanguageCode.cs,
                        value: 'Textový stav dostupnosti zobrazený u produktu. Počet kusů skladem se jím nemění.',
                    },
                    {
                        languageCode: LanguageCode.en,
                        value: 'Availability text shown on the product. It does not change the stock quantity.',
                    },
                ],
                options: availabilitySelectOptions(),
            },
            {
                name: 'videos',
                type: 'string',
                list: true,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Videa' },
                    { languageCode: LanguageCode.en, value: 'Videos' },
                ],
                description: [
                    {
                        languageCode: LanguageCode.cs,
                        value: 'Odkazy na YouTube, Vimeo nebo přímý soubor videa. Zobrazí se pod galerií produktu.',
                    },
                    {
                        languageCode: LanguageCode.en,
                        value: 'YouTube, Vimeo or direct video file links. Shown under the product gallery.',
                    },
                ],
            },
            {
                name: 'relatedProducts',
                type: 'relation',
                entity: Product,
                list: true,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Připojené produkty' },
                    { languageCode: LanguageCode.en, value: 'Related products' },
                ],
                description: [
                    {
                        languageCode: LanguageCode.cs,
                        value: 'Příslušenství, které se nabídne hned po vložení produktu do košíku.',
                    },
                    {
                        languageCode: LanguageCode.en,
                        value: 'Accessories offered immediately after this product is added to the cart.',
                    },
                ],
            },
            {
                name: 'categories',
                type: 'relation',
                entity: Collection,
                list: true,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Kategorie' },
                    { languageCode: LanguageCode.en, value: 'Categories' },
                ],
                description: [
                    {
                        languageCode: LanguageCode.cs,
                        value: 'Kategorie, ve kterých se produkt zobrazí. Hlavní kategorii označte radio tlačítkem — použije se v drobečkové navigaci.',
                    },
                    {
                        languageCode: LanguageCode.en,
                        value: 'Categories where this product is listed. Mark the primary category with the radio button — it is used for breadcrumbs.',
                    },
                ],
                ui: { component: 'czech-commerce.collection-tree' },
            },
            {
                name: 'primaryCategory',
                type: 'relation',
                entity: Collection,
                nullable: true,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Hlavní kategorie' },
                    { languageCode: LanguageCode.en, value: 'Primary category' },
                ],
                description: [
                    {
                        languageCode: LanguageCode.cs,
                        value: 'Drobečková navigace a související produkty. Produkt se do ní také zařadí.',
                    },
                    {
                        languageCode: LanguageCode.en,
                        value: 'Used for breadcrumbs and related products. The product is listed in this category too.',
                    },
                ],
                ui: { component: 'czech-commerce.hidden-field' },
            },
            {
                name: 'parameters',
                type: 'struct',
                list: true,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Parametry' },
                    { languageCode: LanguageCode.en, value: 'Parameters' },
                ],
                ui: { component: 'czech-commerce.parameter-list' },
                fields: [
                    {
                        name: 'name',
                        type: 'string',
                        label: [
                            { languageCode: LanguageCode.cs, value: 'Název' },
                            { languageCode: LanguageCode.en, value: 'Name' },
                        ],
                    },
                    {
                        name: 'value',
                        type: 'string',
                        label: [
                            { languageCode: LanguageCode.cs, value: 'Hodnota' },
                            { languageCode: LanguageCode.en, value: 'Value' },
                        ],
                    },
                ],
            },
            {
                name: 'filterEntries',
                type: 'struct',
                list: true,
                public: false,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Hodnoty filtrů' },
                    { languageCode: LanguageCode.en, value: 'Filter values' },
                ],
                description: [
                    {
                        languageCode: LanguageCode.cs,
                        value: 'Novou hodnotu zapište jako u parametrů. Při uložení se založí jako hodnota facety, i když ještě neexistuje. Výšku, šířku a hloubku zapište jako celé číslo v milimetrech, bez jednotky. Parametry produktu se tím nemění.',
                    },
                    {
                        languageCode: LanguageCode.en,
                        value: 'Type a new value the same way as a parameter. Saving creates the facet value when it does not exist yet. Enter height, width and depth as a whole number of millimetres, without a unit. Product parameters stay unchanged.',
                    },
                ],
                fields: [
                    {
                        name: 'facet',
                        type: 'string',
                        label: [
                            { languageCode: LanguageCode.cs, value: 'Filtr' },
                            { languageCode: LanguageCode.en, value: 'Filter' },
                        ],
                        options: FILTER_FACETS.map(facet => ({
                            value: facet.nameCs,
                            label: [
                                { languageCode: LanguageCode.cs, value: facet.nameCs },
                                { languageCode: LanguageCode.en, value: facet.nameEn },
                            ],
                        })),
                    },
                    {
                        name: 'value',
                        type: 'string',
                        label: [
                            { languageCode: LanguageCode.cs, value: 'Hodnota' },
                            { languageCode: LanguageCode.en, value: 'Value' },
                        ],
                    },
                ],
            },
            {
                name: 'downloads',
                type: 'relation',
                entity: Asset,
                list: true,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Soubory ke stažení' },
                    { languageCode: LanguageCode.en, value: 'Downloads' },
                ],
            },
        );

        config.customFields.ProductVariant.push(
            {
                name: 'shippingProfile',
                type: 'string',
                defaultValue: SHIPPING_PROFILES.STANDARD,
                public: false,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Profil dopravy' },
                    { languageCode: LanguageCode.en, value: 'Shipping profile' },
                ],
                options: [
                    option(SHIPPING_PROFILES.STANDARD, 'Bez omezení', 'Standard'),
                    option(SHIPPING_PROFILES.HOME_DELIVERY_ONLY, 'Pouze kurýr', 'Home delivery only'),
                    option(SHIPPING_PROFILES.PICKUP_POINT_ONLY, 'Pouze výdejní místo', 'Pickup point only'),
                    option(SHIPPING_PROFILES.PERSONAL_PICKUP_ONLY, 'Pouze osobní odběr', 'Personal pickup only'),
                    option(SHIPPING_PROFILES.NO_PICKUP_POINT, 'Bez výdejního místa', 'No pickup point'),
                ],
            },
            {
                name: 'weightKg',
                type: 'float',
                defaultValue: 0,
                public: false,
                ui: { component: 'number-form-input', suffix: ' kg', min: 0, step: 0.01 },
                label: [
                    { languageCode: LanguageCode.cs, value: 'Hmotnost pro dopravu' },
                    { languageCode: LanguageCode.en, value: 'Shipping weight' },
                ],
                description: [
                    { languageCode: LanguageCode.cs, value: 'Hmotnost jednoho kusu pro výpočet dopravy. Při uložení produktu se přepíše hodnotou z produktu.' },
                    { languageCode: LanguageCode.en, value: 'Weight of one item used for shipping. Saving the product overwrites it with the product value.' },
                ],
            },
            {
                name: 'ean',
                type: 'string',
                nullable: true,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'EAN' },
                    { languageCode: LanguageCode.en, value: 'EAN' },
                ],
            },
            {
                name: 'recommendedPrice',
                type: 'int',
                nullable: true,
                public: true,
                ui: { component: 'currency-form-input' },
                label: [
                    { languageCode: LanguageCode.cs, value: 'Cena doporučená výrobcem' },
                    { languageCode: LanguageCode.en, value: 'Recommended retail price' },
                ],
                description: [
                    { languageCode: LanguageCode.cs, value: 'Cena s DPH. Zobrazí se jen tehdy, když je vyšší než prodejní cena.' },
                    { languageCode: LanguageCode.en, value: 'Price including tax. Shown only when it is higher than the selling price.' },
                ],
            },
            {
                name: 'availability',
                type: 'string',
                nullable: true,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Dostupnost' },
                    { languageCode: LanguageCode.en, value: 'Availability' },
                ],
                description: [
                    {
                        languageCode: LanguageCode.cs,
                        value: 'Textový stav dostupnosti této varianty. Prázdný výběr převezme dostupnost z produktu. Počet kusů skladem se zadává v poli Sklad.',
                    },
                    {
                        languageCode: LanguageCode.en,
                        value: 'Availability text for this variant. An empty selection inherits the product availability. Stock quantity is set in the Stock field.',
                    },
                ],
                options: availabilitySelectOptions(),
            },
            {
                name: 'parameters',
                type: 'struct',
                list: true,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Parametry' },
                    { languageCode: LanguageCode.en, value: 'Parameters' },
                ],
                description: [
                    {
                        languageCode: LanguageCode.cs,
                        value: 'Parametry této varianty. Na webu se doplní k parametrům produktu. Stejný název přepíše hodnotu z produktu.',
                    },
                    {
                        languageCode: LanguageCode.en,
                        value: 'Parameters of this variant. Shown with the product parameters on the storefront. A matching name overrides the product value.',
                    },
                ],
                ui: { component: 'czech-commerce.parameter-list' },
                fields: [
                    {
                        name: 'name',
                        type: 'string',
                        label: [
                            { languageCode: LanguageCode.cs, value: 'Název' },
                            { languageCode: LanguageCode.en, value: 'Name' },
                        ],
                    },
                    {
                        name: 'value',
                        type: 'string',
                        label: [
                            { languageCode: LanguageCode.cs, value: 'Hodnota' },
                            { languageCode: LanguageCode.en, value: 'Value' },
                        ],
                    },
                ],
            },
        );

        config.customFields.ShippingMethod.push(
            {
                name: 'adminLabel',
                type: 'string',
                nullable: true,
                public: false,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Štítek' },
                    { languageCode: LanguageCode.en, value: 'Internal label' },
                ],
                description: [
                    {
                        languageCode: LanguageCode.cs,
                        value: 'Interní označení limitů hmotnosti a ceny. Zákazník ho na e-shopu neuvidí.',
                    },
                    {
                        languageCode: LanguageCode.en,
                        value: 'Internal label for weight and price limits. Customers never see this on the storefront.',
                    },
                ],
            },
            {
                name: 'deliveryType',
                type: 'string',
                defaultValue: DELIVERY_TYPES.HOME_DELIVERY,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Typ doručení' },
                    { languageCode: LanguageCode.en, value: 'Delivery type' },
                ],
                options: [
                    option(DELIVERY_TYPES.HOME_DELIVERY, 'Kurýr na adresu', 'Home delivery'),
                    option(DELIVERY_TYPES.PICKUP_POINT, 'Výdejní místo', 'Pickup point'),
                    option(DELIVERY_TYPES.PERSONAL_PICKUP, 'Osobní odběr', 'Personal pickup'),
                ],
            },
            {
                name: 'allowedPaymentMethods',
                type: 'relation',
                entity: PaymentMethod,
                list: true,
                public: false,
                label: [
                    { languageCode: LanguageCode.cs, value: 'Povolené platby' },
                    { languageCode: LanguageCode.en, value: 'Allowed payment methods' },
                ],
                description: [
                    {
                        languageCode: LanguageCode.cs,
                        value: 'Platby dostupné po výběru tohoto způsobu dopravy. Prázdný výběr znamená všechny aktivní platby.',
                    },
                    {
                        languageCode: LanguageCode.en,
                        value: 'Payment methods available after this shipping method is selected. An empty selection allows every active payment method.',
                    },
                ],
            },
        );

        config.customFields.StockMovement ??= [];
        config.customFields.StockMovement.push({
            name: 'ledgerOrigin',
            type: 'string',
            nullable: true,
            public: false,
            readonly: true,
            ui: { dashboard: false },
        });

        config.customFields.Order.push(
            { name: 'pickupPointCarrier', type: 'string', nullable: true, public: true },
            { name: 'pickupPointId', type: 'string', nullable: true, public: true },
            { name: 'pickupPointName', type: 'string', nullable: true, public: true },
            { name: 'pickupPointAddress', type: 'string', nullable: true, public: true },
            {
                name: 'companyIco',
                type: 'string',
                nullable: true,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'IČO' },
                    { languageCode: LanguageCode.en, value: 'Company ID' },
                ],
            },
            {
                name: 'companyDic',
                type: 'string',
                nullable: true,
                public: true,
                label: [
                    { languageCode: LanguageCode.cs, value: 'DIČ' },
                    { languageCode: LanguageCode.en, value: 'VAT ID' },
                ],
            },
        );

        config.shippingOptions.shippingEligibilityCheckers ??= [];
        config.shippingOptions.shippingEligibilityCheckers.push(czechShippingEligibilityChecker);
        config.shippingOptions.shippingCalculators ??= [];
        config.shippingOptions.shippingCalculators.push(czechTieredShippingCalculator);
        const percentageActionIndex = config.promotionOptions.promotionActions.findIndex(
            action => action.code === merchandisePercentageDiscount.code,
        );
        if (percentageActionIndex >= 0) {
            config.promotionOptions.promotionActions[percentageActionIndex] =
                merchandisePercentageDiscount;
        } else {
            config.promotionOptions.promotionActions.push(merchandisePercentageDiscount);
        }
        config.paymentOptions.paymentMethodEligibilityCheckers ??= [];
        config.paymentOptions.paymentMethodEligibilityCheckers.push(czechPaymentEligibilityChecker);
        return config;
    },
})
export class CzechCommercePlugin {}

export { runStockImport } from './stock-ledger';
