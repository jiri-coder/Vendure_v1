'use client';

import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { CreditCard, Loader2 } from 'lucide-react';
import { useCheckout } from '../checkout-provider';
import {useTranslations} from 'next-intl';
import {useState} from 'react';
import {selectPaymentMethod as selectPaymentMethodAction} from '../actions';
import {Price} from '@/features/pricing/price';

interface PaymentStepProps {
  onComplete: () => void;
}

export default function PaymentStep({ onComplete }: PaymentStepProps) {
  const t = useTranslations('Checkout');
  const {
    order,
    paymentMethods,
    selectedPaymentMethodCode,
    setSelectedPaymentMethodCode,
    updateOrder,
  } = useCheckout();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePaymentChange = async (paymentMethodCode: string) => {
    if (submitting || paymentMethodCode === selectedPaymentMethodCode) return;
    setSubmitting(true);
    setError(null);
    try {
      const updatedOrder = await selectPaymentMethodAction(paymentMethodCode);
      updateOrder(updatedOrder);
      setSelectedPaymentMethodCode(paymentMethodCode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to select payment method');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = () => {
    if (!selectedPaymentMethodCode) return;
    onComplete();
  };

  if (paymentMethods.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{t('noPaymentMethods')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="font-semibold">{t('selectPaymentMethod')}</h3>

      <RadioGroup
        value={selectedPaymentMethodCode || ''}
        onValueChange={handlePaymentChange}
        disabled={submitting}
      >
        {paymentMethods.map((method) => (
          <Label key={method.code} htmlFor={method.code} className="cursor-pointer">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <RadioGroupItem value={method.code} id={method.code} />
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">{method.name}</p>
                  {method.description && (
                    <p className="text-sm text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: method.description }} />
                  )}
                </div>
                {method.adjustment !== 0 && (
                  <span className={method.adjustment < 0 ? 'font-medium text-green-600' : 'font-medium'}>
                    {method.adjustment > 0 ? '+' : ''}
                    <Price value={method.adjustment} currencyCode={order.currencyCode} />
                  </span>
                )}
              </div>
            </Card>
          </Label>
        ))}
      </RadioGroup>

      <Button
        onClick={handleContinue}
        disabled={!selectedPaymentMethodCode || submitting}
        className="w-full"
      >
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('continueToReview')}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
