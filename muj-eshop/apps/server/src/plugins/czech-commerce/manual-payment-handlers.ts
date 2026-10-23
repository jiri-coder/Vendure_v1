import {
    LanguageCode,
    Order,
    PaymentMethodHandler,
} from '@vendure/core';

type ManualPaymentKind = 'BANK_TRANSFER' | 'COD' | 'PAY_AT_PICKUP';

export const PAYMENT_ADJUSTMENT_SKU_PREFIX = 'payment-method-adjustment';

export const paymentPricingArgs = {
    fixedFee: {
        type: 'int' as const,
        defaultValue: 0,
        ui: { component: 'currency-form-input' },
        label: [
            { languageCode: LanguageCode.cs, value: 'Fixní částka' },
            { languageCode: LanguageCode.en, value: 'Fixed amount' },
        ],
        description: [
            { languageCode: LanguageCode.cs, value: 'Kladná hodnota je poplatek, záporná hodnota je sleva.' },
            { languageCode: LanguageCode.en, value: 'A positive value is a fee; a negative value is a discount.' },
        ],
    },
    percentageRate: {
        type: 'float' as const,
        defaultValue: 0,
        ui: {
            component: 'number-form-input',
            suffix: '%',
            min: -100,
            step: 0.1,
        },
        label: [
            { languageCode: LanguageCode.cs, value: 'Procentní sazba' },
            { languageCode: LanguageCode.en, value: 'Percentage rate' },
        ],
        description: [
            { languageCode: LanguageCode.cs, value: 'Např. -3 znamená slevu 3 %.' },
            { languageCode: LanguageCode.en, value: 'For example, -3 means a 3% discount.' },
        ],
    },
};

export function calculatePaymentAdjustment(
    baseTotalWithTax: number,
    fixedFee: number | null | undefined,
    percentageRate: number | null | undefined,
    _orderTotalWithTax: number = baseTotalWithTax,
): number {
    const base = Math.max(0, Math.round(baseTotalWithTax));
    const fixed = Number.isFinite(Number(fixedFee)) ? Number(fixedFee) : 0;
    const percentage = Number.isFinite(Number(percentageRate)) ? Number(percentageRate) : 0;
    // Prices are stored in haléře. Both fixed and percentage adjustments are
    // charged in whole CZK so the persisted surcharge never contains haléře.
    const percentageAdjustment =
        Math.sign(percentage) * Math.round(Math.abs(base * percentage) / 10_000) * 100;
    const adjustment = Math.sign(fixed + percentageAdjustment)
        * Math.round(Math.abs(fixed + percentageAdjustment) / 100)
        * 100;

    return Math.max(-base, adjustment);
}

export function paymentAdjustmentSku(paymentMethodCode: string, taxRate: number): string {
    return `${PAYMENT_ADJUSTMENT_SKU_PREFIX}:${paymentMethodCode}:${taxRate}`;
}

function validatePaymentAdjustment(
    order: Order,
    methodCode: string,
    fixedFee: number,
    percentageRate: number,
): string | undefined {
    const paymentSurcharges = (order.surcharges ?? []).filter(surcharge =>
        surcharge.sku.startsWith(`${PAYMENT_ADJUSTMENT_SKU_PREFIX}:`),
    );
    const selectedMethodPrefix = `${PAYMENT_ADJUSTMENT_SKU_PREFIX}:${methodCode}:`;
    if (paymentSurcharges.some(surcharge => !surcharge.sku.startsWith(selectedMethodPrefix))) {
        return 'Objednávka obsahuje cenu jiného způsobu platby. Zvolte způsob platby znovu.';
    }

    const actualAdjustment = paymentSurcharges.reduce(
        (sum, surcharge) => sum + surcharge.priceWithTax,
        0,
    );
    // Payment percentages apply only to merchandise, never to shipping.
    // Surcharges are included in subTotalWithTax, so remove the current
    // payment adjustment before recalculating the expected value.
    const baseTotal = order.subTotalWithTax - actualAdjustment;
    const orderTotal = order.totalWithTax - actualAdjustment;
    const expectedAdjustment = calculatePaymentAdjustment(
        baseTotal,
        fixedFee,
        percentageRate,
        orderTotal,
    );

    if (actualAdjustment !== expectedAdjustment) {
        return 'Cena zvoleného způsobu platby není aktuální. Zvolte způsob platby znovu.';
    }
}

interface ManualPaymentHandlerOptions {
    code: string;
    kind: ManualPaymentKind;
    csDescription: string;
    enDescription: string;
}

function createManualPaymentHandler(options: ManualPaymentHandlerOptions) {
    return new PaymentMethodHandler({
        code: options.code,
        description: [
            { languageCode: LanguageCode.cs, value: options.csDescription },
            { languageCode: LanguageCode.en, value: options.enDescription },
        ],
        args: paymentPricingArgs,
        createPayment: async (ctx, order, amount, args, _metadata, method) => {
            const validationError = validatePaymentAdjustment(
                order,
                method.code,
                args.fixedFee,
                args.percentageRate,
            );
            if (validationError) {
                return {
                    amount,
                    state: 'Error' as const,
                    errorMessage: validationError,
                };
            }

            const methodName =
                method.translations?.find(translation => translation.languageCode === ctx.languageCode)?.name
                ?? method.translations?.find(translation => translation.languageCode === LanguageCode.cs)?.name
                ?? method.code;

            return {
                amount,
                state: 'Authorized' as const,
                transactionId: `${options.code}:${order.code}`,
                metadata: {
                    kind: options.kind,
                    public: {
                        kind: options.kind,
                        methodName,
                    },
                },
            };
        },
        /**
         * Settlement is deliberately an explicit Admin API action. An operator
         * must first verify the bank statement, carrier remittance or in-store
         * receipt and only then settle the authorized Vendure payment.
         */
        settlePayment: async () => ({
            success: true,
            metadata: {
                settledManually: true,
                settledAt: new Date().toISOString(),
            },
        }),
        cancelPayment: async () => ({
            success: true,
            metadata: {
                cancelledManually: true,
                cancelledAt: new Date().toISOString(),
            },
        }),
        /**
         * Invoking a manual refund records that an operator has completed the
         * out-of-band refund. It does not initiate a bank or cash transaction.
         */
        createRefund: async (_ctx, _input, _amount, order) => ({
            state: 'Settled' as const,
            transactionId: `manual-refund:${order.code}:${Date.now()}`,
            metadata: {
                refundedManually: true,
                refundedAt: new Date().toISOString(),
            },
        }),
    });
}

export const bankTransferPaymentHandler = createManualPaymentHandler({
    code: 'bank-transfer-payment-handler',
    kind: 'BANK_TRANSFER',
    csDescription: 'Bankovní převod s ručním potvrzením přijetí platby',
    enDescription: 'Bank transfer with manual payment confirmation',
});

export const cashOnDeliveryPaymentHandler = createManualPaymentHandler({
    code: 'cash-on-delivery-payment-handler',
    kind: 'COD',
    csDescription: 'Dobírka s ručním potvrzením platby po vyúčtování dopravcem',
    enDescription: 'Cash on delivery settled after carrier remittance',
});

export function paymentPublicKind(payment: { metadata?: unknown }): string | undefined {
    const metadata = payment.metadata as { kind?: string; public?: { kind?: string } } | undefined;
    return metadata?.public?.kind || metadata?.kind;
}

export function isCashOnDeliveryOrder(order: Order): boolean {
    return (order.payments ?? []).some(
        payment =>
            payment.state !== 'Cancelled' &&
            payment.state !== 'Declined' &&
            payment.state !== 'Error' &&
            paymentPublicKind(payment) === 'COD',
    );
}

export function orderHasSettledPayment(order: Order): boolean {
    return (order.payments ?? []).some(payment => payment.state === 'Settled');
}

export const payAtPickupPaymentHandler = createManualPaymentHandler({
    code: 'pay-at-pickup-payment-handler',
    kind: 'PAY_AT_PICKUP',
    csDescription: 'Platba při osobním odběru s ručním potvrzením přijetí platby',
    enDescription: 'Payment at personal pickup with manual confirmation',
});
