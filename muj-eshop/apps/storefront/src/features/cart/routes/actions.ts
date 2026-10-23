'use server';

import {mutate} from '@/platform/vendure/api';
import {RemoveFromCartMutation, AdjustCartItemMutation, ApplyPromotionCodeMutation, RemovePromotionCodeMutation, ClearCartPaymentAdjustmentMutation} from '@/features/cart/graphql';
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {revalidatePath, updateTag} from 'next/cache';
import {getLocale} from 'next-intl/server';

async function invalidateOrderViews() {
    const locale = await getLocale();
    updateTag('cart');
    updateTag('active-order');
    revalidatePath(`/${locale}/checkout`);
}

export async function clearCartPaymentAdjustment() {
    await mutate(ClearCartPaymentAdjustmentMutation, {}, {useAuthToken: true});
    await invalidateOrderViews();
}

export async function removeFromCart(lineId: string) {
    const currencyCode = await getActiveCurrencyCode();
    await mutate(RemoveFromCartMutation, {lineId}, {useAuthToken: true, currencyCode});
    await invalidateOrderViews();
}

export async function adjustQuantity(lineId: string, quantity: number) {
    const currencyCode = await getActiveCurrencyCode();
    await mutate(AdjustCartItemMutation, {lineId, quantity}, {useAuthToken: true, currencyCode});
    await invalidateOrderViews();
}

export async function applyPromotionCode(formData: FormData) {
    const code = formData.get('code') as string;
    if (!code) return;

    const currencyCode = await getActiveCurrencyCode();
    await mutate(ApplyPromotionCodeMutation, {couponCode: code}, {useAuthToken: true, currencyCode});
    await invalidateOrderViews();
}

export async function removePromotionCode(formData: FormData) {
    const code = formData.get('code') as string;
    if (!code) return;

    const currencyCode = await getActiveCurrencyCode();
    await mutate(RemovePromotionCodeMutation, {couponCode: code}, {useAuthToken: true, currencyCode});
    await invalidateOrderViews();
}
