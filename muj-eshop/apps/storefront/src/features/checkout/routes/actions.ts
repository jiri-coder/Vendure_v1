'use server';

import {mutate, query} from '@/platform/vendure/api';
import {SetOrderShippingAddressMutation, SetOrderBillingAddressMutation, SetOrderShippingMethodMutation, SetOrderCustomFieldsMutation, AddPaymentToOrderMutation, TransitionOrderToStateMutation, SetCustomerForOrderMutation, SelectPaymentMethodMutation, GetEligiblePaymentMethodsQuery} from '@/features/checkout/graphql';
import {RegisterCustomerAccountMutation} from '@/features/authentication/graphql';
import {CreateCustomerAddressMutation} from '@/features/account/graphql';
import {revalidatePath, updateTag} from 'next/cache';
import {redirect} from '@/platform/i18n/navigation';
import {getLocale} from 'next-intl/server';

interface AddressInput {
    fullName: string;
    streetLine1: string;
    streetLine2?: string;
    city: string;
    province: string;
    postalCode: string;
    countryCode: string;
    phoneNumber: string;
    company?: string;
}

function toCreateAddressInput(address: AddressInput) {
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

export async function setShippingAddress(
    shippingAddress: AddressInput,
    useSameForBilling: boolean,
    billingAddress?: AddressInput,
    taxIds?: { companyIco?: string; companyDic?: string },
) {
    const shippingInput = toCreateAddressInput(shippingAddress);
    const shippingResult = await mutate(
        SetOrderShippingAddressMutation,
        {input: shippingInput},
        {useAuthToken: true}
    );

    if (shippingResult.data.setOrderShippingAddress.__typename !== 'Order') {
        throw new Error('Failed to set shipping address');
    }

    const billingInput = useSameForBilling
        ? shippingInput
        : billingAddress
          ? toCreateAddressInput(billingAddress)
          : undefined;
    if (!billingInput) {
        throw new Error('Failed to set billing address');
    }

    const billingResult = await mutate(
        SetOrderBillingAddressMutation,
        {input: billingInput},
        {useAuthToken: true}
    );

    if (billingResult.data.setOrderBillingAddress.__typename !== 'Order') {
        throw new Error('Failed to set billing address');
    }

    if (taxIds) {
        const customFieldsResult = await mutate(
            SetOrderCustomFieldsMutation,
            {
                input: {
                    customFields: {
                        companyIco: taxIds.companyIco?.trim() || null,
                        companyDic: taxIds.companyDic?.trim() || null,
                    },
                },
            },
            {useAuthToken: true}
        );
        if (customFieldsResult.data.setOrderCustomFields.__typename !== 'Order') {
            throw new Error('Failed to save company tax IDs');
        }
    }

    const locale = await getLocale();
    revalidatePath(`/${locale}/checkout`);
}

interface PickupPointInput {
    carrier: string;
    id: string;
    name?: string;
    address?: string;
}

export async function setShippingMethod(
    shippingMethodId: string,
    pickupPoint?: PickupPointInput,
) {
    const result = await mutate(
        SetOrderShippingMethodMutation,
        {shippingMethodId: [shippingMethodId]},
        {useAuthToken: true}
    );

    if (result.data.setOrderShippingMethod.__typename !== 'Order') {
        throw new Error('Failed to set shipping method');
    }

    const customFieldsResult = await mutate(
        SetOrderCustomFieldsMutation,
        {
            input: {
                customFields: {
                    pickupPointCarrier: pickupPoint?.carrier ?? null,
                    pickupPointId: pickupPoint?.id ?? null,
                    pickupPointName: pickupPoint?.name ?? null,
                    pickupPointAddress: pickupPoint?.address ?? null,
                },
            },
        },
        {useAuthToken: true}
    );

    if (customFieldsResult.data.setOrderCustomFields.__typename !== 'Order') {
        throw new Error('Failed to save pickup point');
    }

    const locale = await getLocale();
    revalidatePath(`/${locale}/checkout`);
    const paymentMethodsRes = await query(GetEligiblePaymentMethodsQuery, {}, {
        useAuthToken: true,
        fetch: {cache: 'no-store'},
    });
    return {
        order: result.data.setOrderShippingMethod,
        paymentMethods: paymentMethodsRes.data.eligiblePaymentMethodsWithPrice?.filter(method => method.isEligible) ?? [],
    };
}

export async function createCustomerAddress(address: AddressInput) {
    const result = await mutate(
        CreateCustomerAddressMutation,
        {input: toCreateAddressInput(address)},
        {useAuthToken: true}
    );

    if (!result.data.createCustomerAddress) {
        throw new Error('Failed to create customer address');
    }

    const locale = await getLocale();
    revalidatePath(`/${locale}/checkout`);
    return result.data.createCustomerAddress;
}

export async function transitionToArrangingPayment() {
    const result = await mutate(
        TransitionOrderToStateMutation,
        {state: 'ArrangingPayment'},
        {useAuthToken: true}
    );

    if (result.data.transitionOrderToState?.__typename === 'OrderStateTransitionError') {
        const errorResult = result.data.transitionOrderToState;
        throw new Error(
            `Failed to transition order state: ${errorResult.errorCode} - ${errorResult.message}`
        );
    }

    const locale = await getLocale();
    revalidatePath(`/${locale}/checkout`);
}

export async function selectPaymentMethod(paymentMethodCode: string | null) {
    const result = await mutate(
        SelectPaymentMethodMutation,
        {code: paymentMethodCode},
        {useAuthToken: true}
    );

    const locale = await getLocale();
    revalidatePath(`/${locale}/checkout`);
    return result.data.selectPaymentMethod;
}

export async function placeOrder(paymentMethodCode: string) {
    // Recalculate and validate the payment adjustment immediately before payment.
    await selectPaymentMethod(paymentMethodCode);

    // Then transition the order to ArrangingPayment state.
    await transitionToArrangingPayment();

    // Add payment to the order
    const result = await mutate(
        AddPaymentToOrderMutation,
        {
            input: {
                method: paymentMethodCode,
                metadata: {},
            },
        },
        {useAuthToken: true}
    );

    if (result.data.addPaymentToOrder.__typename !== 'Order') {
        const errorResult = result.data.addPaymentToOrder;
        throw new Error(
            `Failed to place order: ${errorResult.errorCode} - ${errorResult.message}`
        );
    }

    const orderCode = result.data.addPaymentToOrder.code;

    // Update the cart tag to immediately invalidate cached cart data
    updateTag('cart');
    updateTag('active-order');

    const locale = await getLocale();
    redirect({href: `/order-confirmation/${orderCode}`, locale});
}

interface GuestCustomerInput {
    emailAddress: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    createAccount?: boolean;
    password?: string;
}

export type SetCustomerForOrderResult =
    | { success: true; accountCreated?: boolean }
    | { success: false; errorCode: 'EMAIL_CONFLICT'; message: string }
    | { success: false; errorCode: 'GUEST_CHECKOUT_DISABLED'; message: string }
    | { success: false; errorCode: 'NO_ACTIVE_ORDER'; message: string }
    | { success: false; errorCode: 'UNKNOWN'; message: string };

export async function setCustomerForOrder(
    input: GuestCustomerInput
): Promise<SetCustomerForOrderResult> {
    const { createAccount, password, ...customer } = input;
    const result = await mutate(
        SetCustomerForOrderMutation,
        { input: customer },
        { useAuthToken: true }
    );

    const response = result.data.setCustomerForOrder;

    switch (response.__typename) {
        case 'Order': {
            if (createAccount && password) {
                const registerResult = await mutate(
                    RegisterCustomerAccountMutation,
                    {
                        input: {
                            emailAddress: customer.emailAddress,
                            firstName: customer.firstName,
                            lastName: customer.lastName,
                            phoneNumber: customer.phoneNumber,
                            password,
                        },
                    },
                    { useAuthToken: true },
                );
                const registerResponse = registerResult.data.registerCustomerAccount;
                if (registerResponse.__typename !== 'Success') {
                    return {
                        success: false,
                        errorCode: 'UNKNOWN',
                        message: registerResponse.message,
                    };
                }
                const locale = await getLocale();
                revalidatePath(`/${locale}/checkout`);
                return { success: true, accountCreated: true };
            }
            const locale = await getLocale();
            revalidatePath(`/${locale}/checkout`);
            return { success: true };
        }
        case 'AlreadyLoggedInError':
            return { success: true };
        case 'EmailAddressConflictError':
            return { success: false, errorCode: 'EMAIL_CONFLICT', message: response.message };
        case 'GuestCheckoutError':
            return { success: false, errorCode: 'GUEST_CHECKOUT_DISABLED', message: response.message };
        case 'NoActiveOrderError':
            return { success: false, errorCode: 'NO_ACTIVE_ORDER', message: response.message };
        default:
            return { success: false, errorCode: 'UNKNOWN', message: 'Unknown error' };
    }
}
