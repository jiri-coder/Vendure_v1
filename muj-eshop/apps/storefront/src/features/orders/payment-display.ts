type PaymentMetadata = {
    public?: {
        methodName?: string;
        kind?: string;
    };
} | null;

export function customerPaymentMethodName(
    payment: { method: string; metadata?: unknown },
    surcharges?: Array<{ sku?: string | null; description: string }> | null,
): string {
    const metadata = payment.metadata as PaymentMetadata;
    const storedName = metadata?.public?.methodName?.trim();
    if (storedName) {
        return storedName;
    }

    const paymentAdjustment = surcharges?.find(surcharge =>
        surcharge.sku?.startsWith('payment-method-adjustment:'),
    );
    if (paymentAdjustment?.description) {
        return paymentAdjustment.description;
    }

    return payment.method;
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
