import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    ActiveOrderService,
    Allow,
    Ctx,
    EntityHydrator,
    Order,
    OrderService,
    PaymentMethodService,
    Permission,
    RequestContext,
    Transaction,
    UserInputError,
} from '@vendure/core';
import { gql } from 'graphql-tag';
import {
    calculatePaymentAdjustment,
    PAYMENT_ADJUSTMENT_SKU_PREFIX,
    paymentAdjustmentSku,
} from './manual-payment-handlers';
import { customerPaymentMethodLabel } from './payment-method-labels';
import { ShippingPaymentRestrictionService } from './shipping-payment-restriction.service';

export const paymentPricingShopApiExtensions = gql`
    type PricedPaymentMethodQuote {
        id: ID!
        code: String!
        name: String!
        description: String!
        isEligible: Boolean!
        eligibilityMessage: String
        fixedFee: Money!
        percentageRate: Float!
        adjustment: Money!
    }

    type AdvancePaymentOffer {
        percentageRate: Float!
        fixedFee: Money!
    }

    extend type Query {
        eligiblePaymentMethodsWithPrice: [PricedPaymentMethodQuote!]!
        advancePaymentOffer: AdvancePaymentOffer
    }

    extend type Mutation {
        selectPaymentMethod(code: String): Order!
    }
`;

interface PaymentPricing {
    fixedFee: number;
    percentageRate: number;
}

function operationArgument(
    args: Array<{ name: string; value: string }> | undefined,
    name: string,
): number {
    const value = Number(args?.find(arg => arg.name === name)?.value ?? 0);
    return Number.isFinite(value) ? value : 0;
}

function getPaymentPricing(paymentMethod: {
    handler: { args?: Array<{ name: string; value: string }> };
}): PaymentPricing {
    return {
        fixedFee: operationArgument(paymentMethod.handler.args, 'fixedFee'),
        percentageRate: operationArgument(paymentMethod.handler.args, 'percentageRate'),
    };
}

function existingPaymentAdjustment(order: Order): number {
    return (order.surcharges ?? [])
        .filter(surcharge => surcharge.sku.startsWith(`${PAYMENT_ADJUSTMENT_SKU_PREFIX}:`))
        .reduce((sum, surcharge) => sum + surcharge.priceWithTax, 0);
}

@Resolver()
export class PaymentPricingShopResolver {
    constructor(
        private readonly activeOrderService: ActiveOrderService,
        private readonly entityHydrator: EntityHydrator,
        private readonly orderService: OrderService,
        private readonly paymentMethodService: PaymentMethodService,
        private readonly shippingPaymentRestriction: ShippingPaymentRestrictionService,
    ) {}

    @Query()
    @Allow(Permission.Public)
    async advancePaymentOffer(@Ctx() ctx: RequestContext) {
        const methods = await this.paymentMethodService.findAll(ctx, { take: 100 });
        const method = methods.items.find(item =>
            item.enabled && item.handler.code === 'bank-transfer-payment-handler',
        );
        if (!method) {
            return null;
        }
        const pricing = getPaymentPricing(method);
        if (pricing.percentageRate >= 0 && pricing.fixedFee >= 0) {
            return null;
        }
        return pricing;
    }

    @Query()
    @Allow(Permission.Owner)
    async eligiblePaymentMethodsWithPrice(@Ctx() ctx: RequestContext) {
        if (!ctx.authorizedAsOwnerOnly) {
            return [];
        }
        const order = await this.activeOrderService.getActiveOrder(ctx, undefined);
        if (!order) {
            return [];
        }
        await this.entityHydrator.hydrate(ctx, order, {
            relations: ['lines', 'shippingLines', 'surcharges'],
        });

        const quotes = this.shippingPaymentRestriction.applyToQuotes(
            await this.orderService.getEligiblePaymentMethods(ctx, order.id),
            await this.shippingPaymentRestriction.allowedPaymentMethodIdsForOrder(ctx, order),
        );
        const currentAdjustment = existingPaymentAdjustment(order);
        const baseTotal = order.subTotalWithTax - currentAdjustment;
        const orderTotal = order.totalWithTax - currentAdjustment;

        return Promise.all(quotes.map(async quote => {
            const { paymentMethod } =
                await this.paymentMethodService.getMethodAndOperations(ctx, quote.code);
            const pricing = getPaymentPricing(paymentMethod);
            return {
                ...quote,
                ...pricing,
                adjustment: calculatePaymentAdjustment(
                    baseTotal,
                    pricing.fixedFee,
                    pricing.percentageRate,
                    orderTotal,
                ),
            };
        }));
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.Owner)
    async selectPaymentMethod(
        @Ctx() ctx: RequestContext,
        @Args('code') code?: string | null,
    ): Promise<Order> {
        if (!ctx.authorizedAsOwnerOnly) {
            throw new UserInputError('error.no-active-order');
        }
        let order = await this.activeOrderService.getActiveOrder(ctx, undefined);
        if (!order || order.state !== 'AddingItems') {
            throw new UserInputError('error.no-active-order');
        }

        for (const surcharge of await this.orderService.getOrderSurcharges(ctx, order.id)) {
            if (surcharge.sku.startsWith(`${PAYMENT_ADJUSTMENT_SKU_PREFIX}:`)) {
                order = await this.orderService.removeSurchargeFromOrder(ctx, order.id, surcharge.id);
            }
        }

        if (!code) {
            return order;
        }

        await this.entityHydrator.hydrate(ctx, order, {
            relations: ['lines', 'shippingLines', 'surcharges'],
        });
        const quotes = this.shippingPaymentRestriction.applyToQuotes(
            await this.orderService.getEligiblePaymentMethods(ctx, order.id),
            await this.shippingPaymentRestriction.allowedPaymentMethodIdsForOrder(ctx, order),
        );
        const quote = quotes.find(item => item.code === code && item.isEligible);
        if (!quote) {
            throw new UserInputError('error.payment-method-not-eligible');
        }

        const { paymentMethod } = await this.paymentMethodService.getMethodAndOperations(ctx, code);
        const pricing = getPaymentPricing(paymentMethod);
        const adjustment = calculatePaymentAdjustment(
            order.subTotalWithTax,
            pricing.fixedFee,
            pricing.percentageRate,
            order.totalWithTax,
        );
        if (adjustment === 0) {
            return order;
        }

        const groupedTaxes = new Map<string, {
            description: string;
            taxRate: number;
            gross: number;
        }>();
        for (const line of order.lines) {
            const taxLines = line.taxLines ?? [];
            const totalTaxRate = taxLines.reduce((sum, taxLine) => sum + taxLine.taxRate, 0);
            if (taxLines.length === 0 || totalTaxRate === 0) {
                const existing = groupedTaxes.get('payment adjustment:0');
                if (existing) {
                    existing.gross += line.proratedLinePriceWithTax;
                } else {
                    groupedTaxes.set('payment adjustment:0', {
                        description: 'payment adjustment',
                        taxRate: 0,
                        gross: line.proratedLinePriceWithTax,
                    });
                }
                continue;
            }
            for (const taxLine of taxLines) {
                const key = `${taxLine.description}:${taxLine.taxRate}`;
                const gross = line.proratedLinePriceWithTax * taxLine.taxRate / totalTaxRate;
                const existing = groupedTaxes.get(key);
                if (existing) {
                    existing.gross += gross;
                } else {
                    groupedTaxes.set(key, {
                        description: taxLine.description,
                        taxRate: taxLine.taxRate,
                        gross,
                    });
                }
            }
        }
        const taxGroups = [...groupedTaxes.values()];
        if (taxGroups.length === 0) {
            taxGroups.push({ description: 'payment adjustment', taxRate: 0, gross: order.subTotalWithTax });
        }

        let allocated = 0;
        const allocationBase = order.subTotalWithTax;
        for (let index = 0; index < taxGroups.length; index++) {
            const group = taxGroups[index];
            const isLast = index === taxGroups.length - 1;
            const groupAdjustment = isLast || allocationBase === 0
                ? adjustment - allocated
                : Math.round(adjustment * group.gross / allocationBase);
            allocated += groupAdjustment;
            if (groupAdjustment === 0) {
                continue;
            }

            order = await this.orderService.addSurchargeToOrder(ctx, order.id, {
                description: customerPaymentMethodLabel(code, quote.name),
                sku: paymentAdjustmentSku(code, group.taxRate),
                listPrice: groupAdjustment,
                listPriceIncludesTax: true,
                taxLines: [{
                    description: group.description,
                    taxRate: group.taxRate,
                }],
            });
        }

        return order;
    }
}
