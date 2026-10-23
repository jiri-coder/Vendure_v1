'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Field, FieldLabel, FieldError, FieldGroup } from '@/components/ui/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { Loader2, AlertCircle } from 'lucide-react';
import { Link, useRouter } from '@/platform/i18n/navigation';
import { setCustomerForOrder, SetCustomerForOrderResult } from '../actions';
import { useCheckout } from '../checkout-provider';
import {useTranslations} from 'next-intl';

interface ContactStepProps {
  onComplete: () => void;
}

interface ContactFormData {
  emailAddress: string;
  firstName: string;
  lastName: string;
  createAccount: boolean;
  password: string;
  confirmPassword: string;
}

export default function ContactStep({ onComplete }: ContactStepProps) {
  const t = useTranslations('Checkout');
  const router = useRouter();
  const { order } = useCheckout();
  const customer = order.customer;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SetCustomerForOrderResult | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContactFormData>({
    defaultValues: {
      emailAddress: customer?.emailAddress ?? '',
      firstName: customer?.firstName ?? '',
      lastName: customer?.lastName ?? '',
      createAccount: false,
      password: '',
      confirmPassword: '',
    },
  });
  const createAccount = watch('createAccount');

  useEffect(() => {
    reset({
      emailAddress: customer?.emailAddress ?? '',
      firstName: customer?.firstName ?? '',
      lastName: customer?.lastName ?? '',
    });
  }, [customer?.emailAddress, customer?.firstName, customer?.lastName, reset]);

  function getErrorMessage(error: SetCustomerForOrderResult) {
    if (error.success) return null;

    switch (error.errorCode) {
      case 'EMAIL_CONFLICT':
        return (
          <>
            {t('emailConflict')}{' '}
            <Link href="/sign-in?redirectTo=/checkout" className="underline hover:no-underline">
              {t('emailConflictSignIn')}
            </Link>{' '}
            {t('emailConflictSuffix')}
          </>
        );
      case 'GUEST_CHECKOUT_DISABLED':
        return t('guestCheckoutDisabled');
      case 'NO_ACTIVE_ORDER':
        return (
          <>
            {t('cartEmpty')}{' '}
            <Link href="/" className="underline hover:no-underline">
              {t('cartEmptyShop')}
            </Link>
          </>
        );
      default:
        return error.message;
    }
  }

  const onSubmit = async (data: ContactFormData) => {
    setLoading(true);
    setError(null);

    try {
      const result = await setCustomerForOrder({
        emailAddress: data.emailAddress,
        firstName: data.firstName,
        lastName: data.lastName,
        createAccount: data.createAccount,
        password: data.createAccount ? data.password : undefined,
      });

      if (result.success) {
        router.refresh();
        onComplete();
      } else {
        setError(result);
      }
    } catch (err) {
      console.error('Error setting customer:', err);
      setError({ success: false, errorCode: 'UNKNOWN', message: t('unexpectedError') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t('alreadyHaveAccount')}{' '}
        <Link href="/sign-in?redirectTo=/checkout" className="text-primary underline hover:no-underline">
          {t('signInLink')}
        </Link>
      </p>

      {error && !error.success && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{getErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          <div className="grid grid-cols-2 gap-4">
            <Field className="col-span-2">
              <FieldLabel htmlFor="emailAddress">{t('emailAddress')}</FieldLabel>
              <Input
                id="emailAddress"
                type="email"
                {...register('emailAddress', {
                  required: t('emailRequired'),
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: t('invalidEmail'),
                  },
                })}
              />
              <FieldError>{errors.emailAddress?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="firstName">{t('firstName')}</FieldLabel>
              <Input
                id="firstName"
                {...register('firstName', { required: t('firstNameRequired') })}
              />
              <FieldError>{errors.firstName?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="lastName">{t('lastName')}</FieldLabel>
              <Input
                id="lastName"
                {...register('lastName', { required: t('lastNameRequired') })}
              />
              <FieldError>{errors.lastName?.message}</FieldError>
            </Field>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="createAccount"
              checked={createAccount}
              onCheckedChange={checked => setValue('createAccount', checked === true)}
            />
            <label htmlFor="createAccount" className="text-sm font-medium leading-none">
              {t('createAccount')}
            </label>
          </div>
          {createAccount && (
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  {...register('password', {
                    validate: value =>
                      !createAccount || value.length >= 8 || t('passwordMinLength'),
                  })}
                />
                <FieldError>{errors.password?.message}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirmPassword">{t('confirmPassword')}</FieldLabel>
                <PasswordInput
                  id="confirmPassword"
                  autoComplete="new-password"
                  {...register('confirmPassword', {
                    validate: (value, formValues) =>
                      !formValues.createAccount || value === formValues.password || t('passwordsMismatch'),
                  })}
                />
                <FieldError>{errors.confirmPassword?.message}</FieldError>
              </Field>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full mt-4">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('continue')}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}
