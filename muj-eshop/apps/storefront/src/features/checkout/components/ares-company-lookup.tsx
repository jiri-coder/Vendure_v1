'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AresCompany } from '../czech-registers';

interface AresCompanyLookupProps {
    ico: string;
    dic: string;
    disabled?: boolean;
    onIcoChange: (value: string) => void;
    onDicChange: (value: string) => void;
    onCompanyFound: (company: AresCompany) => void;
}

export function AresCompanyLookup({
    ico,
    dic,
    disabled,
    onIcoChange,
    onDicChange,
    onCompanyFound,
}: AresCompanyLookupProps) {
    const t = useTranslations('Checkout');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const lookup = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/czech-registers/ares?ico=${encodeURIComponent(ico)}`);
            const payload = (await response.json()) as { company?: AresCompany; error?: string };
            if (!response.ok || !payload.company) {
                setError(
                    payload.error === 'not_found' || payload.error === 'invalid_ico'
                        ? t('aresNotFound')
                        : t('aresUnavailable'),
                );
                return;
            }
            onCompanyFound(payload.company);
        } catch {
            setError(t('aresUnavailable'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
                <FieldLabel htmlFor="billing-ico">{t('companyIco')}</FieldLabel>
                <div className="flex gap-2">
                    <Input
                        id="billing-ico"
                        inputMode="numeric"
                        autoComplete="off"
                        value={ico}
                        disabled={disabled || loading}
                        onChange={event => onIcoChange(event.target.value)}
                        onKeyDown={event => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void lookup();
                            }
                        }}
                    />
                    <Button type="button" variant="outline" disabled={disabled || loading} onClick={() => void lookup()}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('lookupIco')}
                    </Button>
                </div>
                <FieldError>{error}</FieldError>
            </Field>
            <Field>
                <FieldLabel htmlFor="billing-dic">{t('companyDic')}</FieldLabel>
                <Input
                    id="billing-dic"
                    value={dic}
                    disabled={disabled}
                    onChange={event => onDicChange(event.target.value)}
                />
            </Field>
        </div>
    );
}
