'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin, Truck } from 'lucide-react';
import { useRouter } from '@/platform/i18n/navigation';
import { useCheckout } from '../checkout-provider';
import { setShippingMethod as setShippingMethodAction } from '../actions';
import {selectPaymentMethod as selectPaymentMethodAction} from '../actions';
import {useTranslations} from 'next-intl';
import {Price} from '@/features/pricing/price';
import {plainTextFromHtml} from '@/lib/utils';

interface DeliveryStepProps {
  onComplete: () => void;
}

export default function DeliveryStep({ onComplete }: DeliveryStepProps) {
  const t = useTranslations('Checkout');
  const router = useRouter();
  const {
    shippingMethods,
    order,
    selectedPaymentMethodCode,
    setSelectedPaymentMethodCode,
    setPaymentMethods,
    updateOrder,
  } = useCheckout();
  const orderCustomFields =
    order.customFields && typeof order.customFields === 'object'
      ? order.customFields as Record<string, unknown>
      : {};
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(() => {
    if (order.shippingLines && order.shippingLines.length > 0) {
      return order.shippingLines[0].shippingMethod.id;
    }
    return null;
  });
  const [appliedMethodId, setAppliedMethodId] = useState<string | null>(
    order.shippingLines?.[0]?.shippingMethod.id ?? null
  );
  const [pickupPointCarrier, setPickupPointCarrier] = useState(
    typeof orderCustomFields.pickupPointCarrier === 'string' ? orderCustomFields.pickupPointCarrier : ''
  );
  const [pickupPointId, setPickupPointId] = useState(
    typeof orderCustomFields.pickupPointId === 'string' ? orderCustomFields.pickupPointId : ''
  );
  const [pickupPointName, setPickupPointName] = useState(
    typeof orderCustomFields.pickupPointName === 'string' ? orderCustomFields.pickupPointName : ''
  );
  const [pickupPointAddress, setPickupPointAddress] = useState(
    typeof orderCustomFields.pickupPointAddress === 'string' ? orderCustomFields.pickupPointAddress : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedMethod = shippingMethods.find(method => method.id === selectedMethodId);
  const selectedMethodCustomFields =
    selectedMethod?.customFields && typeof selectedMethod.customFields === 'object'
      ? selectedMethod.customFields as Record<string, unknown>
      : {};
  const requiresPickupPoint = selectedMethodCustomFields.deliveryType === 'PICKUP_POINT';
  const pickupPointComplete =
    !requiresPickupPoint || (pickupPointCarrier.trim() !== '' && pickupPointId.trim() !== '');

  const persistShippingMethod = async (methodId: string) => {
    const method = shippingMethods.find(item => item.id === methodId);
    const customFields =
      method?.customFields && typeof method.customFields === 'object'
        ? method.customFields as Record<string, unknown>
        : {};
    const methodRequiresPickupPoint = customFields.deliveryType === 'PICKUP_POINT';
    setSubmitting(true);
    setError(null);
    try {
      const {order: updatedOrder, paymentMethods: nextPaymentMethods} = await setShippingMethodAction(
        methodId,
        methodRequiresPickupPoint && pickupPointCarrier.trim() !== '' && pickupPointId.trim() !== ''
          ? {
              carrier: pickupPointCarrier.trim(),
              id: pickupPointId.trim(),
              name: pickupPointName.trim(),
              address: pickupPointAddress.trim(),
            }
          : undefined
      );
      updateOrder(updatedOrder);
      setPaymentMethods(nextPaymentMethods);
      setAppliedMethodId(methodId);

      if (selectedPaymentMethodCode && !nextPaymentMethods.some(method => method.code === selectedPaymentMethodCode)) {
        updateOrder(await selectPaymentMethodAction(null));
        setSelectedPaymentMethodCode(null);
      } else if (selectedPaymentMethodCode) {
        try {
          updateOrder(await selectPaymentMethodAction(selectedPaymentMethodCode));
        } catch {
          updateOrder(await selectPaymentMethodAction(null));
          setSelectedPaymentMethodCode(null);
        }
      }
      router.refresh();
      return true;
    } catch (error) {
      console.error('Error setting shipping method:', error);
      setError(error instanceof Error ? error.message : 'Failed to set shipping method');
      setSelectedMethodId(appliedMethodId);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleMethodChange = async (methodId: string) => {
    if (submitting || methodId === appliedMethodId) return;
    setSelectedMethodId(methodId);
    await persistShippingMethod(methodId);
  };

  const handleContinue = async () => {
    if (!selectedMethodId || !pickupPointComplete) return;
    const succeeded = await persistShippingMethod(selectedMethodId);
    if (succeeded) {
      onComplete();
    }
  };

  if (shippingMethods.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{t('noShippingMethods')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="font-semibold">{t('selectShippingMethod')}</h3>

      <RadioGroup
        value={selectedMethodId || ''}
        onValueChange={handleMethodChange}
        disabled={submitting}
      >
        {shippingMethods.map((method) => {
          const methodDescription = plainTextFromHtml(method.description);
          return (
          <Label key={method.id} htmlFor={method.id} className="cursor-pointer">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <RadioGroupItem value={method.id} id={method.id} />
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{method.name}</p>
                    {methodDescription && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {methodDescription}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold">
                    {method.priceWithTax === 0
                      ? t('free')
                      : <Price value={method.priceWithTax} currencyCode={order.currencyCode} />}
                  </p>
                </div>
              </div>
            </Card>
          </Label>
          );
        })}
      </RadioGroup>

      {requiresPickupPoint && (
        <Card className="space-y-4 p-4">
          <div className="flex items-center gap-2 font-medium">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            {t('pickupPoint')}
          </div>
          <p className="text-sm text-muted-foreground">{t('pickupPointHelp')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pickup-carrier">{t('pickupPointCarrier')}</Label>
              <Input
                id="pickup-carrier"
                value={pickupPointCarrier}
                onChange={event => setPickupPointCarrier(event.target.value)}
                placeholder="Packeta"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickup-id">{t('pickupPointId')}</Label>
              <Input
                id="pickup-id"
                value={pickupPointId}
                onChange={event => setPickupPointId(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickup-name">{t('pickupPointName')}</Label>
              <Input
                id="pickup-name"
                value={pickupPointName}
                onChange={event => setPickupPointName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickup-address">{t('pickupPointAddress')}</Label>
              <Input
                id="pickup-address"
                value={pickupPointAddress}
                onChange={event => setPickupPointAddress(event.target.value)}
              />
            </div>
          </div>
        </Card>
      )}

      <Button
        onClick={handleContinue}
        disabled={!selectedMethodId || !pickupPointComplete || submitting}
        className="w-full"
      >
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('continueToPayment')}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
