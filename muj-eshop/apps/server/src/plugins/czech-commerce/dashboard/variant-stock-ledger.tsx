import {
    api,
    Badge,
    Button,
    DetailPageButton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    useLocalFormat,
} from '@vendure/dashboard';
import { Trans } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, History } from 'lucide-react';
import { useState } from 'react';

const VARIANT_STOCK_LEDGER_QUERY = `
    query CzechCommerceVariantStockLedger($id: ID!) {
        productVariant(id: $id) {
            id
            stockMovements(options: { take: 100 }) {
                totalItems
                items {
                    ... on StockMovement {
                        id
                        createdAt
                        type
                        quantity
                    }
                    ... on StockAdjustment {
                        customFields {
                            ledgerOrigin
                        }
                    }
                    ... on Allocation {
                        orderLine {
                            order {
                                id
                                code
                            }
                        }
                    }
                    ... on Sale {
                        orderLine {
                            order {
                                id
                                code
                            }
                        }
                    }
                    ... on Cancellation {
                        orderLine {
                            order {
                                id
                                code
                            }
                        }
                    }
                    ... on Release {
                        orderLine {
                            order {
                                id
                                code
                            }
                        }
                    }
                }
            }
        }
    }
`;

type LedgerOrder = { id: string; code: string };

type LedgerItem = {
    id: string;
    createdAt: string;
    type: string;
    quantity: number;
    customFields?: { ledgerOrigin?: string | null } | null;
    orderLine?: { order?: LedgerOrder | null } | null;
};

type LedgerResponse = {
    productVariant?: {
        id: string;
        stockMovements: {
            totalItems: number;
            items: LedgerItem[];
        };
    } | null;
};

function isVisibleLedgerItem(item: LedgerItem): boolean {
    if (item.type !== 'ADJUSTMENT') {
        return true;
    }
    return item.customFields?.ledgerOrigin !== 'import';
}

function MovementLabel({ type }: { type: string }) {
    switch (type) {
        case 'SALE':
            return <Trans>Sale</Trans>;
        case 'ALLOCATION':
            return <Trans>Reservation</Trans>;
        case 'RELEASE':
            return <Trans>Released reservation</Trans>;
        case 'CANCELLATION':
            return <Trans>Cancellation</Trans>;
        case 'RETURN':
            return <Trans>Return</Trans>;
        case 'ADJUSTMENT':
            return <Trans>Manual change</Trans>;
        default:
            return <>{type}</>;
    }
}

export function VariantStockLedger({
    context,
}: {
    context: { entity?: { id?: string } };
}) {
    const variantId = context.entity?.id;
    const canLoad = Boolean(variantId) && variantId !== 'new';
    const [open, setOpen] = useState(false);
    const { formatDate } = useLocalFormat();
    const { data, isLoading } = useQuery({
        queryKey: ['czech-commerce-variant-stock-ledger', variantId],
        enabled: open && canLoad,
        queryFn: () => api.query(VARIANT_STOCK_LEDGER_QUERY, { id: variantId }) as Promise<LedgerResponse>,
    });

    if (!canLoad) {
        return null;
    }

    const items = (data?.productVariant?.stockMovements.items ?? [])
        .filter(isVisibleLedgerItem)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return (
        <div>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground -ml-2 h-8 gap-1.5 px-2"
                onClick={() => setOpen(current => !current)}
                aria-expanded={open}
            >
                <History className="h-3.5 w-3.5" />
                {open ? <Trans>Hide stock history</Trans> : <Trans>Show stock history</Trans>}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </Button>
            {open ? (
                isLoading ? (
                    <p className="text-muted-foreground mt-2 text-sm"><Trans>Loading stock movements…</Trans></p>
                ) : items.length === 0 ? (
                    <p className="text-muted-foreground mt-2 text-sm"><Trans>No recorded stock movements.</Trans></p>
                ) : (
                    <div className="mt-2">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><Trans>Date</Trans></TableHead>
                                    <TableHead><Trans>Type</Trans></TableHead>
                                    <TableHead className="text-right"><Trans>Quantity</Trans></TableHead>
                                    <TableHead><Trans>Order</Trans></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map(item => {
                                    const order = item.orderLine?.order;
                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell className="whitespace-nowrap">
                                                {formatDate(item.createdAt, {
                                                    dateStyle: 'short',
                                                    timeStyle: 'short',
                                                })}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">
                                                    <MovementLabel type={item.type} />
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {item.quantity > 0 ? `+${item.quantity}` : String(item.quantity)}
                                            </TableCell>
                                            <TableCell>
                                                {order ? (
                                                    <DetailPageButton href={`/orders/${order.id}`} label={order.code} />
                                                ) : item.type === 'ADJUSTMENT' ? (
                                                    <span className="text-muted-foreground"><Trans>Administrator</Trans></span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )
            ) : null}
        </div>
    );
}
