'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FieldGroup } from '@/components/ui/field';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { useRouter } from '@/platform/i18n/navigation';
import { useCheckout } from '../checkout-provider';
import { setShippingAddress, createCustomerAddress } from '../actions';
import { useTranslations } from 'next-intl';
import { AresCompanyLookup } from '../../components/ares-company-lookup';
import {
    CheckoutAddressFields,
    type AddressFormValues,
    type CheckoutAddressFormValues,
} from '../../components/checkout-address-fields';
import type { AresCompany } from '../../czech-registers';

interface ShippingAddressStepProps {
  onComplete: () => void;
}

const emptyAddress = (countryCode: string): AddressFormValues => ({
  fullName: '',
  company: '',
  streetLine1: '',
  streetLine2: '',
  city: '',
  province: '',
  postalCode: '',
  countryCode,
  phoneNumber: '',
});

function toShippingFields(address: AddressFormValues): AddressFormValues {
  return {
    fullName: address.fullName,
    company: address.company || '',
    streetLine1: address.streetLine1,
    streetLine2: '',
    city: address.city,
    province: '',
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    phoneNumber: address.phoneNumber,
  };
}

export default function ShippingAddressStep({ onComplete }: ShippingAddressStepProps) {
  const t = useTranslations('Checkout');
  const router = useRouter();
  const { addresses, countries, order, isGuest } = useCheckout();
  const defaultCountry = countries.find(country => country.code === 'CZ')?.code || countries[0]?.code || 'CZ';
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(() => {
    if (order.shippingAddress) {
      const matchingAddress = addresses.find(
        (a) =>
          a.streetLine1 === order.shippingAddress?.streetLine1 &&
          a.postalCode === order.shippingAddress?.postalCode
      );
      if (matchingAddress) return matchingAddress.id;
    }
    const defaultAddress = addresses.find((a) => a.defaultShippingAddress);
    return defaultAddress?.id || null;
  });
  const [dialogOpen, setDialogOpen] = useState(addresses.length === 0 && !isGuest);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [useSameForBilling, setUseSameForBilling] = useState(true);

  const getDefaultFormValues = (): CheckoutAddressFormValues => {
    const customerFullName = order.customer
      ? `${order.customer.firstName} ${order.customer.lastName}`.trim()
      : '';
    const shipping = order.shippingAddress;
    const billing = order.billingAddress;
    return {
      fullName: shipping?.fullName || customerFullName,
      company: shipping?.company || '',
      streetLine1: shipping?.streetLine1 || '',
      streetLine2: shipping?.streetLine2 || '',
      city: shipping?.city || '',
      province: shipping?.province || '',
      postalCode: shipping?.postalCode || '',
      countryCode: countries.find(c => c.name === shipping?.country)?.code || defaultCountry,
      phoneNumber: shipping?.phoneNumber || order.customer?.phoneNumber || '',
      billing: {
        ...emptyAddress(defaultCountry),
        fullName: billing?.fullName || customerFullName,
        company: billing?.company || '',
        streetLine1: billing?.streetLine1 || '',
        streetLine2: billing?.streetLine2 || '',
        city: billing?.city || '',
        province: billing?.province || '',
        postalCode: billing?.postalCode || '',
        countryCode: countries.find(c => c.name === billing?.country)?.code || defaultCountry,
        phoneNumber: billing?.phoneNumber || order.customer?.phoneNumber || '',
        ico: order.customFields?.companyIco || '',
        dic: order.customFields?.companyDic || '',
      },
    };
  };

  const { register, handleSubmit, formState: { errors }, reset, control, setValue, getValues, watch } = useForm<CheckoutAddressFormValues>({
    defaultValues: getDefaultFormValues()
  });
  const billingIco = watch('billing.ico') ?? '';
  const billingDic = watch('billing.dic') ?? '';

  const persistAddresses = async (shipping: AddressFormValues, billing?: AddressFormValues & { ico?: string; dic?: string }) => {
    await setShippingAddress(
      toShippingFields(shipping),
      useSameForBilling,
      useSameForBilling || !billing ? undefined : toShippingFields(billing),
      useSameForBilling
        ? { companyIco: '', companyDic: '' }
        : { companyIco: billing?.ico, companyDic: billing?.dic },
    );
  };

  const handleSelectExistingAddress = async () => {
    if (!selectedAddressId) return;

    setLoading(true);
    try {
      const selectedAddress = addresses.find(a => a.id === selectedAddressId);
      if (!selectedAddress) return;
      const billing = getValues('billing');
      await persistAddresses({
        fullName: selectedAddress.fullName || '',
        company: selectedAddress.company || '',
        streetLine1: selectedAddress.streetLine1,
        streetLine2: selectedAddress.streetLine2 || '',
        city: selectedAddress.city || '',
        province: selectedAddress.province || '',
        postalCode: selectedAddress.postalCode || '',
        countryCode: selectedAddress.country.code,
        phoneNumber: selectedAddress.phoneNumber || '',
      }, billing);
      router.refresh();
      onComplete();
    } catch (error) {
      console.error('Error setting address:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSaveNewAddress = async (data: CheckoutAddressFormValues) => {
    setSaving(true);
    try {
      const newAddress = await createCustomerAddress(toShippingFields(data));
      setDialogOpen(false);
      reset();
      router.refresh();
      setSelectedAddressId(newAddress.id);
    } catch (error) {
      console.error('Error creating address:', error);
      alert(`Error creating address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const onSubmitGuestAddress = async (data: CheckoutAddressFormValues) => {
    setLoading(true);
    try {
      await persistAddresses(toShippingFields(data), data.billing);
      router.refresh();
      onComplete();
    } catch (error) {
      console.error('Error setting address:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyAresCompany = (company: AresCompany) => {
    setValue('billing.ico', company.ico);
    setValue('billing.dic', company.dic);
    setValue('billing.company', company.company);
    setValue('billing.streetLine1', company.streetLine1, { shouldValidate: true });
    setValue('billing.streetLine2', '');
    setValue('billing.city', company.city, { shouldValidate: true });
    setValue('billing.province', '');
    setValue('billing.postalCode', company.postalCode, { shouldValidate: true });
    setValue('billing.countryCode', 'CZ', { shouldValidate: true });
  };

  const billingSection = (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="same-billing"
          checked={useSameForBilling}
          onCheckedChange={(checked) => setUseSameForBilling(checked === true)}
        />
        <label
          htmlFor="same-billing"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {t('useSameForBilling')}
        </label>
      </div>
      {!useSameForBilling && (
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="font-semibold">{t('billingAddress')}</h3>
          <AresCompanyLookup
            ico={billingIco}
            dic={billingDic}
            disabled={loading || saving}
            onIcoChange={value => setValue('billing.ico', value)}
            onDicChange={value => setValue('billing.dic', value)}
            onCompanyFound={applyAresCompany}
          />
          <CheckoutAddressFields
            prefix="billing"
            register={register}
            control={control}
            setValue={setValue}
            errors={errors}
            countries={countries}
            disabled={loading || saving}
            required={!useSameForBilling}
            enableRuian={false}
          />
        </div>
      )}
    </div>
  );

  if (isGuest) {
    return (
      <div className="space-y-6">
        <form onSubmit={handleSubmit(onSubmitGuestAddress)}>
          <FieldGroup>
            <CheckoutAddressFields
              register={register}
              control={control}
              setValue={setValue}
              errors={errors}
              countries={countries}
              disabled={loading}
              enableRuian
            />
            {billingSection}
            <Button type="submit" disabled={loading} className="w-full mt-4">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('continue')}
            </Button>
          </FieldGroup>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {addresses.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold">{t('selectSavedAddress')}</h3>
          <RadioGroup value={selectedAddressId || ''} onValueChange={setSelectedAddressId}>
            {addresses.map((address) => (
              <div key={address.id} className="flex items-start space-x-3">
                <RadioGroupItem value={address.id} id={address.id} className="mt-1" />
                <Label htmlFor={address.id} className="flex-1 cursor-pointer">
                  <Card className="p-4">
                    <div className="leading-tight space-y-0">
                      <p className="font-medium">{address.fullName}</p>
                      {address.company && <p className="text-sm text-muted-foreground">{address.company}</p>}
                      <p className="text-sm text-muted-foreground">
                        {address.streetLine1}
                        {address.streetLine2 && `, ${address.streetLine2}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {address.city}, {address.province} {address.postalCode}
                      </p>
                      <p className="text-sm text-muted-foreground">{address.country.name}</p>
                      <p className="text-sm text-muted-foreground">{address.phoneNumber}</p>
                    </div>
                  </Card>
                </Label>
              </div>
            ))}
          </RadioGroup>

          {billingSection}

          <div className="flex gap-3">
            <Button
              onClick={handleSubmit(async () => handleSelectExistingAddress())}
              disabled={!selectedAddressId || loading}
              className="flex-1"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('continueWithSelected')}
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger render={<Button type="button" variant="outline" />}>
                {t('addNewAddress')}
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit(onSaveNewAddress)}>
                  <DialogHeader>
                    <DialogTitle>{t('addNewAddress')}</DialogTitle>
                    <DialogDescription>
                      {t('addNewAddressDescription')}
                    </DialogDescription>
                  </DialogHeader>

                  <FieldGroup className="my-6">
                    <CheckoutAddressFields
                      register={register}
                      control={control}
                      setValue={setValue}
                      errors={errors}
                      countries={countries}
                      disabled={saving}
                      enableRuian
                    />
                  </FieldGroup>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                      {t('cancel')}
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('saveAddress')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

      {addresses.length === 0 && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button type="button" className="w-full" />}>
            {t('addShippingAddress')}
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit(onSaveNewAddress)}>
              <DialogHeader>
                <DialogTitle>{t('addShippingAddress')}</DialogTitle>
                <DialogDescription>
                  {t('addShippingAddressDescription')}
                </DialogDescription>
              </DialogHeader>

              <FieldGroup className="my-6">
                <CheckoutAddressFields
                  register={register}
                  control={control}
                  setValue={setValue}
                  errors={errors}
                  countries={countries}
                  disabled={saving}
                  enableRuian
                />
              </FieldGroup>

              <DialogFooter>
                <Button type="submit" disabled={saving} className="w-full">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('saveAddress')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
