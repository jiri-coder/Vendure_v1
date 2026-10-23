export const AVAILABILITY_CODES = [
    'IN_STOCK',
    'SUPPLIER_24H',
    'SUPPLIER_3D',
    'STOCK_4_8D',
    'STOCK_1_2W',
    'USUALLY_14D',
    'USUALLY_30D',
    'ON_REQUEST',
    'SOLD_OUT',
] as const;

export type AvailabilityCode = (typeof AVAILABILITY_CODES)[number];

export function availabilityStatus(value: string | null | undefined): AvailabilityCode | null {
    return AVAILABILITY_CODES.find(code => code === value) ?? null;
}

export function availabilityTone(code: AvailabilityCode): string {
    if (code === 'SOLD_OUT') {
        return 'text-destructive';
    }
    if (code === 'ON_REQUEST' || code === 'USUALLY_14D' || code === 'USUALLY_30D' || code === 'STOCK_4_8D' || code === 'STOCK_1_2W') {
        return 'text-amber-700';
    }
    return 'text-green-600';
}

export function saleableStockCount(stockLevel: string | null | undefined): number | null {
    if (!stockLevel || stockLevel === 'OUT_OF_STOCK') {
        return 0;
    }
    if (stockLevel === 'IN_STOCK' || stockLevel === 'LOW_STOCK') {
        return null;
    }
    const count = Number.parseInt(stockLevel, 10);
    return Number.isFinite(count) ? count : null;
}

export function availabilityDot(code: AvailabilityCode): string {
    if (code === 'SOLD_OUT') {
        return 'bg-destructive';
    }
    if (code === 'ON_REQUEST' || code === 'USUALLY_14D' || code === 'USUALLY_30D' || code === 'STOCK_4_8D' || code === 'STOCK_1_2W') {
        return 'bg-amber-600';
    }
    return 'bg-green-600';
}
