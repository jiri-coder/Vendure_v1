import { defineDashboardExtension } from '@vendure/dashboard';
import {
    CollectionTreeInput,
    HiddenFormInput,
    collectionTreeComponentId,
    hiddenFieldComponentId,
} from './collection-tree-input';
import { ParameterListInput, parameterListComponentId } from './parameter-list-input';
import { VariantStockLedger } from './variant-stock-ledger';

type SchemaFieldInfo = [string, boolean, boolean, boolean];
type SchemaInfo = {
    types?: Record<string, Record<string, SchemaFieldInfo>>;
    inputs?: Record<string, Record<string, SchemaFieldInfo>>;
};

function ensureAdminLabelInDashboardSchema() {
    const schema = (globalThis as unknown as { schemaInfo?: SchemaInfo }).schemaInfo;
    const field: SchemaFieldInfo = ['String', true, false, false];
    for (const collection of [schema?.types, schema?.inputs]) {
        if (!collection) {
            continue;
        }
        for (const [typeName, fields] of Object.entries(collection)) {
            if (typeName.includes('ShippingMethodCustomFields') && fields.adminLabel == null) {
                fields.adminLabel = field;
            }
        }
    }
}

ensureAdminLabelInDashboardSchema();

function ShippingAdminLabelCell({
    getValue,
    row,
}: {
    getValue: () => unknown;
    row: { original: { customFields?: { adminLabel?: string | null } } };
}) {
    const value = getValue() ?? row.original.customFields?.adminLabel;
    if (typeof value !== 'string' || value.trim() === '') {
        return <span className="text-muted-foreground">—</span>;
    }
    return (
        <span className="inline-flex max-w-[22rem] items-center rounded-md border bg-muted px-2 py-0.5 text-xs font-medium">
            {value}
        </span>
    );
}

defineDashboardExtension({
    pageBlocks: [
        {
            id: 'czech-commerce-variant-stock-ledger',
            location: {
                pageId: 'product-variant-detail',
                column: 'main',
                position: { blockId: 'stock', order: 'after' },
            },
            component: VariantStockLedger,
        },
    ],
    customFormComponents: {
        customFields: [
            {
                id: parameterListComponentId,
                component: ParameterListInput,
            },
            {
                id: collectionTreeComponentId,
                component: CollectionTreeInput,
            },
            {
                id: hiddenFieldComponentId,
                component: HiddenFormInput,
            },
        ],
    },
    dataTables: [
        {
            pageId: 'order-list',
            extendListDocument: `
                query {
                    orders {
                        items {
                            hasNote
                        }
                    }
                }
            `,
        },
        {
            pageId: 'shipping-method-list',
            extendListDocument: `
                query {
                    shippingMethods {
                        items {
                            customFields {
                                adminLabel
                            }
                        }
                    }
                }
            `,
            displayComponents: [
                {
                    column: 'adminLabel',
                    component: ShippingAdminLabelCell,
                },
            ],
            viewOptionDefaults: {
                columnVisibility: {
                    name: true,
                    adminLabel: true,
                    code: true,
                    fulfillmentHandlerCode: true,
                    description: false,
                    deliveryType: false,
                    allowedPaymentMethods: false,
                },
                columnOrder: ['name', 'adminLabel', 'code', 'fulfillmentHandlerCode'],
            },
        },
    ],
    detailForms: [
        {
            pageId: 'shipping-method-detail',
            extendDetailDocument: `
                query {
                    shippingMethod {
                        customFields {
                            adminLabel
                            deliveryType
                            allowedPaymentMethods {
                                id
                                name
                                code
                                enabled
                            }
                        }
                    }
                }
            `,
        },
    ],
});
