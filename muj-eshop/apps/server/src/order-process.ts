import { isGraphQlErrorResult, Logger, OrderProcess, OrderService, OrderState } from '@vendure/core';
import { isCashOnDeliveryOrder } from './plugins/czech-commerce/manual-payment-handlers';

declare module '@vendure/core' {
    interface CustomOrderStates {
        Processing: never;
    }
}

let orderService: OrderService;

export const processingOrderProcess: OrderProcess<'Processing'> = {
    transitions: {
        PaymentAuthorized: {
            to: ['Processing'],
        },
        PaymentSettled: {
            to: ['Processing'],
        },
        Processing: {
            to: [
                'PartiallyShipped',
                'Shipped',
                'Cancelled',
                'Modifying',
                'PaymentSettled',
                'ArrangingAdditionalPayment',
            ],
        },
        Shipped: {
            to: ['PaymentSettled'],
        },
        PartiallyShipped: {
            to: ['PaymentSettled'],
        },
        Delivered: {
            to: ['PaymentSettled'],
        },
        PartiallyDelivered: {
            to: ['PaymentSettled'],
        },
    },
    async init(injector) {
        orderService = injector.get(OrderService);
    },
    async onTransitionEnd(_fromState, toState, data) {
        if (toState !== 'PaymentAuthorized' || !isCashOnDeliveryOrder(data.order)) {
            return;
        }
        const result = await orderService.transitionToState(
            data.ctx,
            data.order.id,
            'Processing' as OrderState,
        );
        if (isGraphQlErrorResult(result)) {
            Logger.error(
                `Dobírku ${data.order.code} se nepodařilo přepnout do stavu Vyřizováno: ${result.message}`,
                'ProcessingOrderProcess',
            );
        }
    },
};
