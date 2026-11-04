'use server';

import {query} from '@/platform/vendure/api';
import {graphql} from '@/platform/vendure/graphql';

const ShopInvoicePdfQuery = graphql(`
    query ShopInvoicePdf($orderCode: String!) {
        shopInvoicePdf(orderCode: $orderCode)
    }
`);

export async function downloadShopInvoicePdf(orderCode: string): Promise<string | null> {
    const {data} = await query(ShopInvoicePdfQuery, {orderCode}, {useAuthToken: true, fetch: {}});
    return data.shopInvoicePdf ?? null;
}
