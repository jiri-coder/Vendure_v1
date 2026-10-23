'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, Truck, CreditCard, Edit, Mail } from 'lucide-react';
import { useCheckout } from '../checkout-provider';
import { placeOrder as placeOrderAction } from '../actions';
import { Price } from '@/features/pricing/price';
import {useTranslations} from 'next-intl';
import {plainTextFromHtml} from '@/lib/utils';

interface ReviewStepProps {
  onEditStep: (step: 'contact' | 'shipping' | 'delivery' | 'payment') => void;
}

export default function ReviewStep({ onEditStep }: ReviewStepProps) {
  const t = useTranslations('Checkout');
  const { order, shippingMethods, paymentMethods, selectedPaymentMethodCode, isGuest } = useCheckout();
  const [loading, setLoading] = useState(false);

  const shippingLine = order.shippingLines?.[0];
  const selectedShippingMethod = shippingLine
    ? shippingMethods.find(method => method.id === shippingLine.shippingMethod.id)
    : undefined;
  const shippingDescription = plainTextFromHtml(
    shippingLine?.shippingMethod.description || selectedShippingMethod?.description,
  );

  const selectedPaymentMethod = paymentMethods.find(
    (method) => method.code === selectedPaymentMethodCode
  );
  const paymentAdjustment = selectedPaymentMethod
    ? (order.surcharges ?? [])
        .filter(surcharge =>
          surcharge.sku?.startsWith(`payment-method-adjustment:${selectedPaymentMethod.code}:`),
        )
        .reduce((total, surcharge) => total + surcharge.priceWithTax, 0)
      || selectedPaymentMethod.adjustment
    : 0;

  const handlePlaceOrder = async () => {
    if (!selectedPaymentMethodCode) return;

    setLoading(true);
    try {
      await placeOrderAction(selectedPaymentMethodCode);
    } catch (error) {
      if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
        throw error;
      }
      console.error('Error placing order:', error);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="font-semibold text-lg">{t('reviewYourOrder')}</h3>

      <div className={`grid grid-cols-1 gap-6 ${isGuest ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
        {isGuest && order.customer && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <h4 className="font-medium">{t('contact')}</h4>
            </div>
            <div className="text-sm space-y-3">
              <div>
                <p className="font-medium">
                  {order.customer.firstName} {order.customer.lastName}
                </p>
                <p className="text-muted-foreground">{order.customer.emailAddress}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditStep('contact')}
              >
                <Edit className="h-4 w-4 mr-1" />
                {t('edit')}
              </Button>
            </div>
          </div>
        )}

        {/* Shipping Address */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <h4 className="font-medium">{t('shippingAddress')}</h4>
          </div>
          {order.shippingAddress ? (
            <div className="text-sm space-y-3">
              <div>
                <p className="font-medium">{order.shippingAddress.fullName}</p>
                {order.shippingAddress.company && (
                  <p className="text-muted-foreground">{order.shippingAddress.company}</p>
                )}
                <p className="text-muted-foreground">{order.shippingAddress.streetLine1}</p>
                <p className="text-muted-foreground">
                  {order.shippingAddress.city} {order.shippingAddress.postalCode}
                </p>
                <p className="text-muted-foreground">{order.shippingAddress.country}</p>
                <p className="text-muted-foreground">{order.shippingAddress.phoneNumber}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditStep('shipping')}
              >
                <Edit className="h-4 w-4 mr-1" />
                {t('edit')}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noShippingAddress')}</p>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <h4 className="font-medium">{t('billingAddress')}</h4>
          </div>
          {order.billingAddress ? (
            <div className="text-sm space-y-3">
              <div>
                <p className="font-medium">{order.billingAddress.fullName}</p>
                {order.billingAddress.company && (
                  <p className="text-muted-foreground">{order.billingAddress.company}</p>
                )}
                {(order.customFields?.companyIco || order.customFields?.companyDic) && (
                  <p className="text-muted-foreground">
                    {[
                      order.customFields.companyIco && `${t('companyIco')} ${order.customFields.companyIco}`,
                      order.customFields.companyDic && `${t('companyDic')} ${order.customFields.companyDic}`,
                    ].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="text-muted-foreground">{order.billingAddress.streetLine1}</p>
                <p className="text-muted-foreground">
                  {order.billingAddress.city} {order.billingAddress.postalCode}
                </p>
                <p className="text-muted-foreground">{order.billingAddress.country}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditStep('shipping')}
              >
                <Edit className="h-4 w-4 mr-1" />
                {t('edit')}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noBillingAddress')}</p>
          )}
        </div>

        {/* Delivery Method */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-muted-foreground" />
            <h4 className="font-medium">{t('deliveryMethod')}</h4>
          </div>
          {order.shippingLines && order.shippingLines.length > 0 ? (
            <div className="text-sm space-y-3">
              <div>
                <p className="font-medium">{order.shippingLines[0].shippingMethod.name}</p>
                {shippingDescription && (
                  <p className="text-muted-foreground mt-1">{shippingDescription}</p>
                )}
                <p className="text-muted-foreground mt-1">
                  {order.shippingLines[0].priceWithTax === 0
                    ? t('free')
                    : <Price value={order.shippingLines[0].priceWithTax} currencyCode={order.currencyCode} />}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditStep('delivery')}
              >
                <Edit className="h-4 w-4 mr-1" />
                {t('edit')}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noDeliveryMethod')}</p>
          )}
        </div>

        {/* Payment Method */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <h4 className="font-medium">{t('paymentMethod')}</h4>
          </div>
          {selectedPaymentMethod ? (
            <div className="text-sm space-y-3">
              <div>
                <p className="font-medium">{selectedPaymentMethod.name}</p>
                {selectedPaymentMethod.description && (
                  <p className="text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: selectedPaymentMethod.description }} />
                )}
                {paymentAdjustment !== 0 && (
                  <p className={paymentAdjustment < 0 ? 'mt-1 font-medium text-green-600' : 'mt-1 text-muted-foreground'}>
                    {paymentAdjustment < 0 ? t('paymentDiscount') : t('paymentFee')}{' '}
                    {paymentAdjustment > 0 ? '+' : ''}
                    <Price value={paymentAdjustment} currencyCode={order.currencyCode} />
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditStep('payment')}
              >
                <Edit className="h-4 w-4 mr-1" />
                {t('edit')}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noPaymentMethod')}</p>
          )}
        </div>
      </div>

      <Button
        onClick={handlePlaceOrder}
        disabled={loading || !order.shippingAddress || !order.shippingLines?.length || !selectedPaymentMethodCode}
        size="lg"
        className="w-full"
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('placeOrder')}
      </Button>

      {(!order.shippingAddress || !order.shippingLines?.length || !selectedPaymentMethodCode) && (
        <p className="text-sm text-destructive text-center">
          {t('completeAllSteps')}
        </p>
      )}
    </div>
  );
}
