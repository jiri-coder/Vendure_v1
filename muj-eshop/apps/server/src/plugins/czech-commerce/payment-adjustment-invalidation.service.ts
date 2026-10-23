import { Injectable, OnModuleInit } from '@nestjs/common';
import {
    EventBus,
    OrderLineEvent,
    OrderService,
    RequestContext,
} from '@vendure/core';
import { PAYMENT_ADJUSTMENT_SKU_PREFIX } from './manual-payment-handlers';

@Injectable()
export class PaymentAdjustmentInvalidationService implements OnModuleInit {
    constructor(
        private readonly eventBus: EventBus,
        private readonly orderService: OrderService,
    ) {}

    onModuleInit() {
        this.eventBus.registerBlockingEventHandler({
            event: OrderLineEvent,
            id: 'clear-payment-adjustment-after-order-line-change',
            handler: event => this.clearPaymentAdjustment(event.ctx, event.order.id),
        });
    }

    private async clearPaymentAdjustment(ctx: RequestContext, orderId: string | number) {
        const surcharges = await this.orderService.getOrderSurcharges(ctx, orderId);
        for (const surcharge of surcharges) {
            if (surcharge.sku.startsWith(`${PAYMENT_ADJUSTMENT_SKU_PREFIX}:`)) {
                await this.orderService.removeSurchargeFromOrder(ctx, orderId, surcharge.id);
            }
        }
    }
}
