'use client';

import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {downloadShopInvoicePdf} from './invoice-download-action';

export function InvoiceDownloadButton({
    orderCode,
    invoiceNumber,
    label,
}: {
    orderCode: string;
    invoiceNumber: string;
    label: string;
}) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function download() {
        setPending(true);
        setError(null);
        try {
            const pdfBase64 = await downloadShopInvoicePdf(orderCode);
            if (!pdfBase64) {
                setError('PDF se nepodařilo stáhnout.');
                return;
            }
            const bytes = Uint8Array.from(atob(pdfBase64), char => char.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `faktura-${invoiceNumber}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
        } catch {
            setError('PDF se nepodařilo stáhnout.');
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="space-y-2">
            <Button type="button" onClick={download} disabled={pending}>
                {pending ? 'Stahování…' : label}
            </Button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
    );
}
