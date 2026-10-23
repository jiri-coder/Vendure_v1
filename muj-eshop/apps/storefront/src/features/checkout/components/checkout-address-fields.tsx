'use client';

import { Controller, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { CountrySelect } from '@/components/ui/country-select';
import { useTranslations } from 'next-intl';
import { RuianAddressInput } from './ruian-address-input';
import type { RuianSuggestion } from '../czech-registers';

export interface AddressFormValues {
    fullName: string;
    company?: string;
    streetLine1: string;
    streetLine2?: string;
    city: string;
    province: string;
    postalCode: string;
    countryCode: string;
    phoneNumber: string;
}

export interface CheckoutAddressFormValues extends AddressFormValues {
    billing?: AddressFormValues & { ico?: string; dic?: string };
}

interface CheckoutAddressFieldsProps {
    prefix?: 'billing';
    register: UseFormRegister<CheckoutAddressFormValues>;
    control: Control<CheckoutAddressFormValues>;
    setValue: UseFormSetValue<CheckoutAddressFormValues>;
    errors: FieldErrors<CheckoutAddressFormValues>;
    countries: Array<{ id: string; code: string; name: string }>;
    disabled?: boolean;
    required?: boolean;
    enableRuian?: boolean;
}

function path(prefix: 'billing' | undefined, name: keyof AddressFormValues) {
    return (prefix ? `billing.${name}` : name) as never;
}

export function CheckoutAddressFields({
    prefix,
    register,
    control,
    setValue,
    errors,
    countries,
    disabled,
    required = true,
    enableRuian = true,
}: CheckoutAddressFieldsProps) {
    const t = useTranslations('Checkout');
    const nestedErrors = prefix ? errors.billing : errors;
    const streetPath = path(prefix, 'streetLine1');
    const cityPath = path(prefix, 'city');
    const postalPath = path(prefix, 'postalCode');
    const countryPath = path(prefix, 'countryCode');

    const applyRuian = (suggestion: RuianSuggestion) => {
        setValue(streetPath, suggestion.streetLine1, { shouldValidate: true });
        setValue(path(prefix, 'streetLine2'), '');
        setValue(cityPath, suggestion.city, { shouldValidate: true });
        setValue(path(prefix, 'province'), '');
        setValue(postalPath, suggestion.postalCode, { shouldValidate: true });
        setValue(countryPath, 'CZ', { shouldValidate: true });
    };

    return (
        <div className="grid grid-cols-2 gap-4">
            <Field className="col-span-2">
                <FieldLabel htmlFor={`${prefix ?? 'shipping'}-fullName`}>{t('fullName')}</FieldLabel>
                <Input
                    id={`${prefix ?? 'shipping'}-fullName`}
                    disabled={disabled}
                    {...register(path(prefix, 'fullName'), required ? { required: t('fullNameRequired') } : {})}
                />
                <FieldError>{nestedErrors?.fullName?.message}</FieldError>
            </Field>

            <Field className="col-span-2">
                <FieldLabel htmlFor={`${prefix ?? 'shipping'}-company`}>{t('company')}</FieldLabel>
                <Input id={`${prefix ?? 'shipping'}-company`} disabled={disabled} {...register(path(prefix, 'company'))} />
            </Field>

            <Field className="col-span-2">
                <FieldLabel htmlFor={`${prefix ?? 'shipping'}-streetLine1`}>{t('streetAddress')}</FieldLabel>
                {enableRuian ? (
                    <Controller
                        name={streetPath}
                        control={control}
                        rules={required ? { required: t('streetRequired') } : {}}
                        render={({ field }) => (
                            <RuianAddressInput
                                id={`${prefix ?? 'shipping'}-streetLine1`}
                                value={field.value ?? ''}
                                disabled={disabled}
                                onChange={field.onChange}
                                onSelect={applyRuian}
                            />
                        )}
                    />
                ) : (
                    <Input
                        id={`${prefix ?? 'shipping'}-streetLine1`}
                        disabled={disabled}
                        {...register(streetPath, required ? { required: t('streetRequired') } : {})}
                    />
                )}
                {enableRuian && <p className="text-xs text-muted-foreground">{t('ruianHint')}</p>}
                <FieldError>{nestedErrors?.streetLine1?.message}</FieldError>
            </Field>

            <Field>
                <FieldLabel htmlFor={`${prefix ?? 'shipping'}-city`}>{t('city')}</FieldLabel>
                <Input
                    id={`${prefix ?? 'shipping'}-city`}
                    disabled={disabled}
                    {...register(cityPath, required ? { required: t('cityRequired') } : {})}
                />
                <FieldError>{nestedErrors?.city?.message}</FieldError>
            </Field>

            <Field>
                <FieldLabel htmlFor={`${prefix ?? 'shipping'}-postalCode`}>{t('postalCode')}</FieldLabel>
                <Input
                    id={`${prefix ?? 'shipping'}-postalCode`}
                    disabled={disabled}
                    {...register(postalPath, required ? { required: t('postalCodeRequired') } : {})}
                />
                <FieldError>{nestedErrors?.postalCode?.message}</FieldError>
            </Field>

            <Field>
                <FieldLabel htmlFor={`${prefix ?? 'shipping'}-countryCode`}>{t('country')}</FieldLabel>
                <Controller
                    name={countryPath}
                    control={control}
                    rules={required ? { required: t('countryRequired') } : {}}
                    render={({ field }) => (
                        <CountrySelect
                            countries={countries}
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={disabled}
                        />
                    )}
                />
                <FieldError>{nestedErrors?.countryCode?.message}</FieldError>
            </Field>

            <Field className="col-span-2">
                <FieldLabel htmlFor={`${prefix ?? 'shipping'}-phoneNumber`}>{t('phoneNumber')}</FieldLabel>
                <Input
                    id={`${prefix ?? 'shipping'}-phoneNumber`}
                    type="tel"
                    disabled={disabled}
                    {...register(path(prefix, 'phoneNumber'), required ? { required: t('phoneRequired') } : {})}
                />
                <FieldError>{nestedErrors?.phoneNumber?.message}</FieldError>
            </Field>
        </div>
    );
}
