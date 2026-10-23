import { Money } from '@/vdb/components/data-display/money.js';
import { Badge } from '@/vdb/components/ui/badge.js';
import { TableCell, TableRow } from '@/vdb/components/ui/table.js';
import { useLocalFormat } from '@/vdb/hooks/use-local-format.js';
import { Trans } from '@lingui/react/macro';

function MoneyGrossNet({
    priceWithTax,
    price,
    currencyCode,
}: {
    priceWithTax: number;
    price: number;
    currencyCode: string;
}) {
    return (
        <div className="flex flex-col gap-1">
            <div>
                <Money value={priceWithTax} currency={currencyCode} />
            </div>
            <div className="text-xs text-muted-foreground">
                <Money value={price} currency={currencyCode} />
            </div>
        </div>
    );
}

type OrderTotals = {
    currencyCode: string;
    surcharges?: Array<{ description: string; price: number; priceWithTax: number }>;
    discounts?: Array<{ description: string; amount: number; amountWithTax: number }>;
    subTotal: number;
    subTotalWithTax: number;
    shipping: number;
    shippingWithTax: number;
    total: number;
    totalWithTax: number;
    shippingLines: Array<{
        id: string;
        shippingMethod: { name: string };
        discountedPriceWithTax: number;
    }>;
};

export interface OrderTableTotalsProps {
    order: OrderTotals;
    columnCount: number;
}

export function OrderTableTotals({ order, columnCount }: Readonly<OrderTableTotalsProps>) {
    const { formatCurrency } = useLocalFormat();
    const currencyCode = order.currencyCode;
    return (
        <>
            {order.surcharges?.length > 0
                ? order.surcharges.map((surcharge, index) => (
                      <TableRow key={`${surcharge.description}-${index}`}>
                          <TableCell colSpan={columnCount - 1} className="h-12">
                              {surcharge.description}
                          </TableCell>
                          <TableCell colSpan={1} className="h-12">
                              <MoneyGrossNet
                                  priceWithTax={surcharge.priceWithTax}
                                  price={surcharge.price}
                                  currencyCode={currencyCode}
                              />
                          </TableCell>
                      </TableRow>
                  ))
                : null}
            {order.discounts?.length > 0
                ? order.discounts.map((discount, index) => (
                      <TableRow key={`${discount.description}-${index}`}>
                          <TableCell colSpan={columnCount - 1} className="h-12">
                              <Trans>Discount</Trans>: {discount.description}
                          </TableCell>
                          <TableCell colSpan={1} className="h-12">
                              <MoneyGrossNet
                                  priceWithTax={discount.amountWithTax}
                                  price={discount.amount}
                                  currencyCode={currencyCode}
                              />
                          </TableCell>
                      </TableRow>
                  ))
                : null}
            <TableRow>
                <TableCell colSpan={columnCount - 1} className="h-12">
                    <Trans>Sub total</Trans>
                </TableCell>
                <TableCell colSpan={1} className="h-12">
                    <MoneyGrossNet
                        priceWithTax={order.subTotalWithTax}
                        price={order.subTotal}
                        currencyCode={currencyCode}
                    />
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell colSpan={columnCount - 1} className="h-12">
                    <div className="flex flex-wrap gap-1">
                        <div>
                            <Trans>Shipping</Trans>
                        </div>
                        {order.shippingLines.map(sl => (
                            <Badge variant="outline" key={sl.id}>
                                {sl.shippingMethod.name}
                                {order.shippingLines.length > 1
                                    ? ` (${formatCurrency(sl.discountedPriceWithTax, order.currencyCode)})`
                                    : ''}
                            </Badge>
                        ))}
                    </div>
                </TableCell>
                <TableCell colSpan={1} className="h-12">
                    <MoneyGrossNet
                        priceWithTax={order.shippingWithTax}
                        price={order.shipping}
                        currencyCode={currencyCode}
                    />
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell colSpan={columnCount - 1} className="h-12 font-bold">
                    <Trans>Total</Trans>
                </TableCell>
                <TableCell colSpan={1} className="h-12 font-bold">
                    <MoneyGrossNet
                        priceWithTax={order.totalWithTax}
                        price={order.total}
                        currencyCode={currencyCode}
                    />
                </TableCell>
            </TableRow>
        </>
    );
}
