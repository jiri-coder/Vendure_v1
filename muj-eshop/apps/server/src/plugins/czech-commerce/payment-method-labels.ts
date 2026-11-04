export const CUSTOMER_PAYMENT_METHOD_NAMES: Record<string, string> = {
    'bank-transfer': 'Platba převodem',
    'cash-on-delivery': 'Platba na dobírku',
    'pay-at-pickup': 'Platba při osobním odběru',
};

function looksLikeCode(value: string): boolean {
    return /^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(value.trim());
}

export function paymentMethodCodeFromAdjustmentSku(sku: string | null | undefined): string | undefined {
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
    name: string,
    priceWithTax: number,
): string {
    if (priceWithTax < 0) {
        return `Sleva za platbu (${name})`;
    }
    if (priceWithTax > 0) {
        return `Příplatek za platbu (${name})`;
    }
    return name;
}
