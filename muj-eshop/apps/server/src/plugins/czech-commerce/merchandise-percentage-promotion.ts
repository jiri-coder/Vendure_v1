import {
    LanguageCode,
    PromotionOrderAction,
} from '@vendure/core';

/**
 * Vendure's default action uses Order.subTotal, which also contains Surcharges.
 * Payment fees must not increase the base of a merchandise promotion.
 *
 * The code intentionally matches Vendure's built-in action so existing and
 * future percentage promotions automatically use the corrected calculation.
 */
export const merchandisePercentageDiscount = new PromotionOrderAction({
    code: 'order_percentage_discount',
    args: {
        discount: {
            type: 'float',
            ui: {
                component: 'number-form-input',
                suffix: '%',
                min: 0,
            },
        },
    },
    execute(ctx, order, args) {
        const merchandiseTotal = order.lines.reduce(
            (total, line) => total + (
                ctx.channel.pricesIncludeTax
                    ? line.proratedLinePriceWithTax
                    : line.proratedLinePrice
            ),
            0,
        );
        const discountInMinorUnits = merchandiseTotal * (args.discount / 100);
        return -Math.round(discountInMinorUnits / 100) * 100;
    },
    description: [
        {
            languageCode: LanguageCode.cs,
            value: 'Sleva { discount } % pouze z ceny zboží',
        },
        {
            languageCode: LanguageCode.en,
            value: 'Discount merchandise by { discount }%',
        },
    ],
});
