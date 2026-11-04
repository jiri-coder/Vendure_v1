const CUSTOMER_PAYMENT_METHOD_NAMES: Record<string, string> = {
    'bank-transfer': 'Platba převodem',
    'cash-on-delivery': 'Platba na dobírku',
    'pay-at-pickup': 'Platba při osobním odběru',
};

type PaymentMetadata = {
    public?: {
        methodName?: string;
        kind?: string;
    };
} | null;

function looksLikeCode(value: string): boolean {
    return /^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(value.trim());
}

function paymentMethodCodeFromAdjustmentSku(sku: string | null | undefined): string | undefined {
    if (!sku?.startsWith('payment-method-adjustment:')) {
        return undefined;
    }
    return sku.slice('payment-method-adjustment:'.length).split(':')[0];
}

export function customerPaymentMethodLabel(code: string, fallback?: string | null): string {
    const normalizedCode = code.replace(/-payment-handler$/, '');
    if (CUSTOMER_PAYMENT_METHOD_NAMES[normalizedCode]) {
        return CUSTOMER_PAYMENT_METHOD_NAMES[normalizedCode];
    }
    const trimmedFallback = fallback?.trim();
    if (trimmedFallback && CUSTOMER_PAYMENT_METHOD_NAMES[trimmedFallback]) {
        return CUSTOMER_PAYMENT_METHOD_NAMES[trimmedFallback];
    }
    if (trimmedFallback && !looksLikeCode(trimmedFallback) && trimmedFallback !== 'Standard Payment') {
        if (trimmedFallback === 'Platba předem na účet') {
            return CUSTOMER_PAYMENT_METHOD_NAMES['bank-transfer'];
        }
        return trimmedFallback;
    }
    return CUSTOMER_PAYMENT_METHOD_NAMES[code] ?? trimmedFallback ?? code;
}

export function paymentAdjustmentCustomerLabel(
    surcharge: { sku?: string | null; description: string; priceWithTax: number },
): string {
    const code = paymentMethodCodeFromAdjustmentSku(surcharge.sku) ?? '';
    const name = customerPaymentMethodLabel(code, surcharge.description);
    if (surcharge.priceWithTax < 0) {
        return `Sleva za platbu (${name})`;
    }
    if (surcharge.priceWithTax > 0) {
        return `Příplatek za platbu (${name})`;
    }
    return name;
}

export function customerPaymentMethodName(
    payment: { method: string; metadata?: unknown },
    surcharges?: Array<{ sku?: string | null; description: string }> | null,
): string {
    const metadata = payment.metadata as PaymentMetadata;
    const matchingSurcharge = surcharges?.find(surcharge =>
        surcharge.sku === `payment-method-adjustment:${payment.method}` ||
        surcharge.sku?.startsWith(`payment-method-adjustment:${payment.method}:`),
    );
    return customerPaymentMethodLabel(
        payment.method,
        metadata?.public?.methodName || matchingSurcharge?.description,
    );
}

export function isCustomerVisibleTransactionId(transactionId: string | null | undefined): boolean {
    if (!transactionId) {
        return false;
    }
    return !transactionId.includes('-payment-handler:');
}

const PAYMENT_STATES = ['Created', 'Authorized', 'Settled', 'Declined', 'Error', 'Cancelled'] as const;

export function isKnownPaymentState(state: string): state is (typeof PAYMENT_STATES)[number] {
    return PAYMENT_STATES.includes(state as (typeof PAYMENT_STATES)[number]);
}
