import { api, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@vendure/dashboard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

const ORDER_INVOICE_QUERY = `
    query CzechCommerceOrderInvoice($id: ID!) {
        order(id: $id) {
            id
            shopInvoice {
                id
                number
                issuedAt
                currencyCode
                totalWithTax
                lines {
                    id
                    description
                    quantity
                    unitPriceWithTax
                    taxRate
                    lineTotalWithTax
                }
            }
        }
    }
`;

const CREATE_INVOICE_MUTATION = `
    mutation CzechCommerceCreateShopInvoice($orderId: ID!) {
        createShopInvoice(orderId: $orderId) {
            id
            number
        }
    }
`;

const UPDATE_INVOICE_MUTATION = `
    mutation CzechCommerceUpdateShopInvoiceLines($id: ID!, $lines: [ShopInvoiceLineInput!]!) {
        updateShopInvoiceLines(id: $id, lines: $lines) {
            id
            number
            totalWithTax
            lines {
                id
                description
                quantity
                unitPriceWithTax
                taxRate
                lineTotalWithTax
            }
        }
    }
`;

const INVOICE_PDF_QUERY = `
    query CzechCommerceShopInvoicePdf($orderId: ID!) {
        shopInvoicePdf(orderId: $orderId)
    }
`;

type InvoiceLine = {
    id: string;
    description: string;
    quantity: number;
    unitPriceWithTax: number;
    taxRate: number;
};

type Invoice = {
    id: string;
    number: string;
    issuedAt: string;
    currencyCode: string;
    totalWithTax: number;
    lines: InvoiceLine[];
};

function formatCzk(halere: number): string {
    return `${(halere / 100).toLocaleString('cs-CZ', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} Kč`;
}

function downloadPdf(base64: string, number: string) {
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `faktura-${number}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
}

export function OrderInvoiceBlock({
    context,
}: {
    context: { entity?: { id?: string } };
}) {
    const orderId = context.entity?.id;
    const canLoad = Boolean(orderId) && orderId !== 'new';
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState<InvoiceLine[]>([]);

    const { data, isLoading } = useQuery({
        queryKey: ['czech-commerce-order-invoice', orderId],
        enabled: canLoad,
        queryFn: () =>
            api.query(ORDER_INVOICE_QUERY, { id: orderId }) as Promise<{
                order?: { shopInvoice?: Invoice | null };
            }>,
    });

    const invoice = data?.order?.shopInvoice ?? null;

    useEffect(() => {
        setDraft(invoice?.lines ?? []);
    }, [invoice]);

    const createInvoice = useMutation({
        mutationFn: () => api.mutate(CREATE_INVOICE_MUTATION, { orderId }) as Promise<unknown>,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['czech-commerce-order-invoice', orderId] }),
    });

    const saveLines = useMutation({
        mutationFn: () =>
            api.mutate(UPDATE_INVOICE_MUTATION, {
                id: invoice?.id,
                lines: draft.map(line => ({
                    id: line.id,
                    description: line.description,
                    quantity: Number(line.quantity) || 1,
                    unitPriceWithTax: Math.round(Number(line.unitPriceWithTax) || 0),
                    taxRate: Number(line.taxRate) || 0,
                })),
            }) as Promise<unknown>,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['czech-commerce-order-invoice', orderId] }),
    });

    const download = useMutation({
        mutationFn: async () => {
            const result = (await api.query(INVOICE_PDF_QUERY, { orderId })) as {
                shopInvoicePdf?: string | null;
            };
            if (!result.shopInvoicePdf || !invoice) {
                throw new Error('PDF se nepodařilo vytvořit');
            }
            downloadPdf(result.shopInvoicePdf, invoice.number);
        },
    });

    if (!canLoad) {
        return null;
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold">Faktura</h3>
                    {invoice ? (
                        <p className="text-muted-foreground text-xs">
                            {invoice.number} · {formatCzk(invoice.totalWithTax)}
                        </p>
                    ) : (
                        <p className="text-muted-foreground text-xs">
                            Faktura se vytvoří automaticky po zaplacení, nebo ji můžete vystavit ručně.
                        </p>
                    )}
                </div>
                <div className="flex gap-2">
                    {invoice ? (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => download.mutate()}
                                disabled={download.isPending}
                            >
                                Stáhnout PDF
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => saveLines.mutate()}
                                disabled={saveLines.isPending}
                            >
                                Uložit položky
                            </Button>
                        </>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => createInvoice.mutate()}
                            disabled={createInvoice.isPending}
                        >
                            Vystavit fakturu
                        </Button>
                    )}
                </div>
            </div>

            {createInvoice.error || saveLines.error || download.error ? (
                <p className="text-destructive text-sm">
                    {(createInvoice.error || saveLines.error || download.error)?.message ||
                        'Operaci se nepodařilo dokončit.'}
                </p>
            ) : null}

            {isLoading ? (
                <p className="text-muted-foreground text-sm">Načítání…</p>
            ) : invoice ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Text položky</TableHead>
                            <TableHead className="w-24">Množství</TableHead>
                            <TableHead className="w-36">Cena s DPH</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {draft.map((line, index) => (
                            <TableRow key={line.id || index}>
                                <TableCell>
                                    <input
                                        className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
                                        value={line.description}
                                        onChange={event => {
                                            const description = event.target.value;
                                            setDraft(current =>
                                                current.map((item, itemIndex) =>
                                                    itemIndex === index ? { ...item, description } : item,
                                                ),
                                            );
                                        }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <input
                                        className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
                                        type="number"
                                        min={1}
                                        value={line.quantity}
                                        onChange={event => {
                                            const quantity = Number(event.target.value);
                                            setDraft(current =>
                                                current.map((item, itemIndex) =>
                                                    itemIndex === index ? { ...item, quantity } : item,
                                                ),
                                            );
                                        }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <input
                                        className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
                                        type="number"
                                        step="0.01"
                                        value={(line.unitPriceWithTax / 100).toFixed(2)}
                                        onChange={event => {
                                            const unitPriceWithTax = Math.round(Number(event.target.value) * 100);
                                            setDraft(current =>
                                                current.map((item, itemIndex) =>
                                                    itemIndex === index ? { ...item, unitPriceWithTax } : item,
                                                ),
                                            );
                                        }}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : null}
        </div>
    );
}
