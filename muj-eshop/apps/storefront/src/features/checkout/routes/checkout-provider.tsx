'use client';

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { CheckoutOrder } from './types';

interface CustomerAddress {
  id: string;
  fullName?: string | null;
  company?: string | null;
  streetLine1: string;
  streetLine2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country: { id: string; code: string; name: string };
  phoneNumber?: string | null;
  defaultShippingAddress?: boolean | null;
  defaultBillingAddress?: boolean | null;
}

interface Country {
  id: string;
  code: string;
  name: string;
}

interface ShippingMethod {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  priceWithTax: number;
  customFields?: unknown;
}

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isEligible: boolean;
  eligibilityMessage?: string | null;
  fixedFee: number;
  percentageRate: number;
  adjustment: number;
}

interface CheckoutContextType {
  order: CheckoutOrder;
  updateOrder: (changes: Partial<CheckoutOrder>) => void;
  addresses: CustomerAddress[];
  countries: Country[];
  shippingMethods: ShippingMethod[];
  paymentMethods: PaymentMethod[];
  setPaymentMethods: (methods: PaymentMethod[]) => void;
  selectedPaymentMethodCode: string | null;
  setSelectedPaymentMethodCode: (code: string | null) => void;
  isGuest: boolean;
}

const CheckoutContext = createContext<CheckoutContextType | null>(null);

interface CheckoutProviderProps {
  children: ReactNode;
  order: CheckoutOrder;
  addresses: CustomerAddress[];
  countries: Country[];
  shippingMethods: ShippingMethod[];
  paymentMethods: PaymentMethod[];
  isGuest: boolean;
}

export function CheckoutProvider({
  children,
  order,
  addresses,
  countries,
  shippingMethods,
  paymentMethods,
  isGuest,
}: CheckoutProviderProps) {
  const [currentOrder, setCurrentOrder] = useState(order);
  const [currentPaymentMethods, setCurrentPaymentMethods] = useState(paymentMethods);
  const selectedPaymentMethodCodeFromOrder = paymentMethods.find(method =>
    order.surcharges?.some(surcharge =>
      surcharge.sku?.startsWith(`payment-method-adjustment:${method.code}:`)
    )
  )?.code ?? null;
  const [selectedPaymentMethodCode, setSelectedPaymentMethodCode] = useState<string | null>(
    selectedPaymentMethodCodeFromOrder
  );

  // A cached checkout route can keep this client component mounted while a fresh
  // active order arrives from the server. Keep the local checkout state aligned
  // with that authoritative order after cart, coupon, or quantity changes.
  useEffect(() => {
    setCurrentOrder(order);
    setCurrentPaymentMethods(paymentMethods);
    setSelectedPaymentMethodCode(selectedPaymentMethodCodeFromOrder);
  }, [order, paymentMethods, selectedPaymentMethodCodeFromOrder]);

  const updateOrder = (changes: Partial<CheckoutOrder>) => {
    setCurrentOrder(previous => ({ ...previous, ...changes }));
  };

  return (
    <CheckoutContext.Provider
      value={{
        order: currentOrder,
        updateOrder,
        addresses,
        countries,
        shippingMethods,
        paymentMethods: currentPaymentMethods,
        setPaymentMethods: setCurrentPaymentMethods,
        selectedPaymentMethodCode,
        setSelectedPaymentMethodCode,
        isGuest,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error('useCheckout must be used within CheckoutProvider');
  }
  return context;
}
