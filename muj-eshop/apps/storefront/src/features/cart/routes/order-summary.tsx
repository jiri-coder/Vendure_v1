import { Link } from '@/platform/i18n/navigation';
import {Button} from '@/components/ui/button';
import {Lock} from 'lucide-react';
import {Price} from '@/features/pricing/price';
import {getTranslations} from 'next-intl/server';

type ActiveOrder = {
    id: string;
    currencyCode: string;
    subTotalWithTax: number;
    shippingWithTax: number;
    totalWithTax: number;
    lines: Array<{
        linePriceWithTax: number;
    }>;
    surcharges?: Array<{
        sku?: string | null;
        priceWithTax: number;
    }> | null;
    discounts?: Array<{
        description: string;
        amountWithTax: number;
    }> | null;
};

export async function OrderSummary({activeOrder}: { activeOrder: ActiveOrder }) {
    const t = await getTranslations('Cart');
    const paymentAdjustment = activeOrder.surcharges?.reduce(
        (total, surcharge) =>
            surcharge.sku?.startsWith('payment-method-adjustment:')
                ? total + surcharge.priceWithTax
                : total,
        0,
    ) ?? 0;
    const merchandiseTotalWithTax = activeOrder.lines.reduce(
        (total, line) => total + line.linePriceWithTax,
        0,
    );
    const cartTotalWithTax = activeOrder.totalWithTax - paymentAdjustment;

    return (
        <div className="border rounded-xl p-6 bg-card sticky top-36 shadow-sm">
            <h2 className="text-xl font-bold mb-4">{t('orderSummary')}</h2>

            <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('subtotal')}</span>
                    <span>
                        <Price value={merchandiseTotalWithTax} currencyCode={activeOrder.currencyCode}/>
                    </span>
                </div>
                {activeOrder.discounts && activeOrder.discounts.length > 0 && (
                    <>
                        {activeOrder.discounts.map((discount, index) => (
                            <div key={index} className="flex justify-between text-sm text-green-600">
                                <span>{discount.description}</span>
                                <span>
                                    <Price value={discount.amountWithTax} currencyCode={activeOrder.currencyCode}/>
                                </span>
                            </div>
                        ))}
                    </>
                )}
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('shipping')}</span>
                    <span>
                        {activeOrder.shippingWithTax > 0
                            ? <Price value={activeOrder.shippingWithTax} currencyCode={activeOrder.currencyCode}/>
                            : t('calculatedAtCheckout')}
                    </span>
                </div>
            </div>

            <div className="border-t pt-4 mb-6">
                <div className="flex justify-between items-baseline text-lg font-bold">
                    <span>{t('total')}</span>
                    <span className="text-2xl">
                        <Price value={cartTotalWithTax} currencyCode={activeOrder.currencyCode}/>
                    </span>
                </div>
            </div>

            <Button render={<Link href="/checkout" prefetch={false} />} nativeButton={false} className="w-full" size="lg">{t('proceedToCheckout')}</Button>

            <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span>{t('secureCheckout')}</span>
            </div>

            <Button render={<Link href="/" />} nativeButton={false} variant="outline" className="w-full mt-3">{t('continueShopping')}</Button>
        </div>
    );
}
