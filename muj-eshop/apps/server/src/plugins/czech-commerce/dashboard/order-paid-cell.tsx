import { Banknote } from 'lucide-react';

function orderIsPaid(row: {
    original: {
        payments?: Array<{ state?: string | null }> | null;
        state?: string | null;
    };
}): boolean {
    const payments = row.original.payments ?? [];
    if (payments.some(payment => payment.state === 'Settled')) {
        return true;
    }
    return row.original.state === 'PaymentSettled';
}

export function OrderPaidCell({
    row,
}: {
    row: {
        original: {
            payments?: Array<{ state?: string | null }> | null;
            state?: string | null;
        };
    };
}) {
    const paid = orderIsPaid(row);

    return (
        <span
            title={paid ? 'Platba zaplacena' : 'Platba nezaplacena'}
            className={
                paid
                    ? 'inline-flex items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 p-1 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                    : 'inline-flex items-center justify-center rounded-md border border-transparent p-1 text-muted-foreground opacity-25'
            }
        >
            <Banknote className="h-3.5 w-3.5" />
            <span className="sr-only">{paid ? 'Platba zaplacena' : 'Platba nezaplacena'}</span>
        </span>
    );
}
