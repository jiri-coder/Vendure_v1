import { Order, Payment } from '@vendure/core';
import { PAYMENT_ADJUSTMENT_SKU_PREFIX } from '../plugins/czech-commerce/manual-payment-handlers';
import {
    customerPaymentMethodLabel,
    paymentAdjustmentCustomerLabel,
    paymentMethodCodeFromAdjustmentSku,
} from '../plugins/czech-commerce/payment-method-labels';

export type EmailPaymentLine = {
    name: string;
    label: string;
    priceWithTax: number;
};

function paymentMethodName(payment: Payment, surchargeDescription?: string): string {
    const metadata = payment.metadata as { public?: { methodName?: string } } | undefined;
    return customerPaymentMethodLabel(
        payment.method,
        metadata?.public?.methodName || surchargeDescription,
    );
}

function adjustmentForPayment(order: Order, payment: Payment) {
    const prefix = `${PAYMENT_ADJUSTMENT_SKU_PREFIX}:${payment.method}`;
    return (order.surcharges ?? []).find(
        item => item.sku === prefix || item.sku.startsWith(`${prefix}:`),
    );
}

export function paymentLinesForEmail(order: Order): EmailPaymentLine[] {
    const surcharges = (order.surcharges ?? []).filter(item =>
        item.sku.startsWith(`${PAYMENT_ADJUSTMENT_SKU_PREFIX}:`),
    );
    const payments = (order.payments ?? []).filter(
        payment => payment.state === 'Authorized' || payment.state === 'Settled',
    );
    const usedSurchargeIds = new Set<string>();
    const lines: EmailPaymentLine[] = [];

    for (const payment of payments) {
        const surcharge = adjustmentForPayment(order, payment);
        if (surcharge) {
            usedSurchargeIds.add(String(surcharge.id));
        }
        const name = paymentMethodName(payment, surcharge?.description);
        const priceWithTax = surcharge?.priceWithTax ?? 0;
        lines.push({
            name,
            priceWithTax,
            label: paymentAdjustmentCustomerLabel(name, priceWithTax),
        });
    }

    for (const surcharge of surcharges) {
        if (usedSurchargeIds.has(String(surcharge.id))) {
            continue;
        }
        const code = paymentMethodCodeFromAdjustmentSku(surcharge.sku) ?? '';
        const name = customerPaymentMethodLabel(code, surcharge.description);
        lines.push({
            name,
            priceWithTax: surcharge.priceWithTax,
            label: paymentAdjustmentCustomerLabel(name, surcharge.priceWithTax),
        });
    }

    return lines;
}
