'use client';

import {useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {Check, Copy} from 'lucide-react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Price} from '@/features/pricing/price';
import {useTranslations} from 'next-intl';

export interface BankTransferInstructions {
    accountName: string;
    accountNumber: string;
    iban: string;
    bankName?: string | null;
    variableSymbol: string;
    amount: number;
    currencyCode: string;
    message: string;
    spdPayload: string;
}

function CopyValue({value}: {value: string}) {
    const t = useTranslations('BankTransferPayment');
    const [copied, setCopied] = useState(false);

    async function copy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    }

    return (
        <Button type="button" variant="ghost" size="icon-xs" onClick={copy} aria-label={t('copy')}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
    );
}

function DetailRow({label, value}: {label: string; value: string}) {
    return (
        <div className="flex items-start justify-between gap-3 text-sm">
            <span className="text-muted-foreground shrink-0">{label}</span>
            <span className="font-medium text-right break-all">{value}</span>
            <CopyValue value={value} />
        </div>
    );
}

export function BankTransferPayBox({instructions}: {instructions: BankTransferInstructions}) {
    const t = useTranslations('BankTransferPayment');

    return (
        <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-[180px_1fr] sm:items-center">
                <div className="flex justify-center">
                    <div className="rounded-md bg-white p-2 shadow-sm">
                        <QRCodeSVG
                            value={instructions.spdPayload}
                            size={164}
                            level="M"
                            bgColor="#ffffff"
                            fgColor="#111111"
                            title={t('qrAlt')}
                        />
                    </div>
                </div>
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">{t('intro')}</p>
                    <DetailRow label={t('accountName')} value={instructions.accountName} />
                    <DetailRow label={t('accountNumber')} value={instructions.accountNumber} />
                    <DetailRow label={t('iban')} value={instructions.iban} />
                    {instructions.bankName ? (
                        <DetailRow label={t('bankName')} value={instructions.bankName} />
                    ) : null}
                    <DetailRow label={t('variableSymbol')} value={instructions.variableSymbol} />
                    <div className="flex items-start justify-between gap-3 text-sm">
                        <span className="text-muted-foreground shrink-0">{t('amount')}</span>
                        <span className="font-semibold text-right">
                            <Price value={instructions.amount} currencyCode={instructions.currencyCode} />
                        </span>
                    </div>
                    <DetailRow label={t('message')} value={instructions.message} />
                </div>
            </CardContent>
        </Card>
    );
}
