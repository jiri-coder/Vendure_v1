/**
 * Must stay identical to calculatePaymentAdjustment in
 * apps/server/src/plugins/czech-commerce/manual-payment-handlers.ts.
 * Prices are in haléře. Percentage applies to merchandise only and the
 * combined adjustment is rounded to whole CZK.
 */
export function calculatePaymentAdjustment(
    baseTotalWithTax: number,
    fixedFee: number | null | undefined,
    percentageRate: number | null | undefined,
    _orderTotalWithTax: number = baseTotalWithTax,
): number {
    const base = Math.max(0, Math.round(baseTotalWithTax));
    const fixed = Number.isFinite(Number(fixedFee)) ? Number(fixedFee) : 0;
    const percentage = Number.isFinite(Number(percentageRate)) ? Number(percentageRate) : 0;
    const percentageAdjustment =
        Math.sign(percentage) * Math.round(Math.abs(base * percentage) / 10_000) * 100;
    const adjustment = Math.sign(fixed + percentageAdjustment)
        * Math.round(Math.abs(fixed + percentageAdjustment) / 100)
        * 100;

    return Math.max(-base, adjustment);
}
