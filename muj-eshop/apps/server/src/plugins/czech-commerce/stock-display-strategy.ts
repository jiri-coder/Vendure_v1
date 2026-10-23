import { ProductVariant, RequestContext, StockDisplayStrategy } from '@vendure/core';

export class NumericStockDisplayStrategy implements StockDisplayStrategy {
    getStockLevel(_ctx: RequestContext, _variant: ProductVariant, saleableStockLevel: number): string {
        return saleableStockLevel < 1 ? 'OUT_OF_STOCK' : String(saleableStockLevel);
    }
}
