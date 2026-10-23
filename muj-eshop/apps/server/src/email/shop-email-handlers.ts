import {
    emailAddressChangeHandler,
    emailVerificationHandler,
    EmailEventListener,
    passwordResetHandler,
    shippingLinesWithMethod,
    transformOrderLineAssetUrls,
} from '@vendure/email-plugin';
import {
    EntityHydrator,
    Injector,
    LanguageCode,
    Order,
    OrderStateTransitionEvent,
    Payment,
} from '@vendure/core';
import { PAYMENT_ADJUSTMENT_SKU_PREFIX } from '../plugins/czech-commerce/manual-payment-handlers';
import { orderStatusAvisoHandler, orderStatusCustomerHandler } from './order-status-emails';

function isNewlyPlacedOrder(event: OrderStateTransitionEvent): boolean {
    return (
        event.fromState === 'ArrangingPayment' &&
        (event.toState === 'PaymentAuthorized' || event.toState === 'PaymentSettled') &&
        !!event.order.customer
    );
}

function isAwaitingPaymentConfirmation(event: OrderStateTransitionEvent): boolean {
    return (
        event.fromState === 'ArrangingPayment' &&
        event.toState === 'PaymentAuthorized' &&
        !!event.order.customer
    );
}

async function loadPlacedOrderData({
    event,
    injector,
}: {
    event: OrderStateTransitionEvent;
    injector: Injector;
}) {
    const entityHydrator = injector.get(EntityHydrator);
    await entityHydrator.hydrate(event.ctx, event.order, {
        relations: [
            'customer',
            'lines.featuredAsset',
            'shippingLines.shippingMethod',
            'surcharges',
            'payments',
        ],
    });
    transformOrderLineAssetUrls(event.ctx, event.order, injector);
    return {
        shippingLines: shippingLinesWithMethod(event.order),
        paymentLines: paymentLinesForEmail(event.order),
    };
}

function paymentMethodName(payment: Payment): string {
    const metadata = payment.metadata as { public?: { methodName?: string } } | undefined;
    const storedName = metadata?.public?.methodName?.trim();
    return storedName || payment.method;
}

function paymentLinesForEmail(order: Order): Array<{ name: string; priceWithTax: number }> {
    const surcharges = order.surcharges ?? [];
    const visiblePayments = (order.payments ?? []).filter(
        payment => payment.state === 'Authorized' || payment.state === 'Settled',
    );

    return visiblePayments.map(payment => {
        const adjustmentSku = `${PAYMENT_ADJUSTMENT_SKU_PREFIX}:${payment.method}`;
        const surcharge = surcharges.find(item => item.sku === adjustmentSku);
        return {
            name: paymentMethodName(payment),
            priceWithTax: surcharge?.priceWithTax ?? 0,
        };
    });
}

export const orderConfirmationHandler = new EmailEventListener('order-confirmation')
    .on(OrderStateTransitionEvent)
    .filter(isAwaitingPaymentConfirmation)
    .loadData(loadPlacedOrderData)
    .setRecipient(event => event.order.customer!.emailAddress)
    .setFrom('{{ fromAddress }}')
    .setLanguageCode(() => LanguageCode.cs)
    .setSubject('Potvrzení objednávky {{ order.code }}')
    .setTemplateVars(event => ({
        order: event.order,
        shippingLines: event.data.shippingLines,
        paymentLines: event.data.paymentLines,
    }));

export const orderAvisoHandler = new EmailEventListener('order-aviso')
    .on(OrderStateTransitionEvent)
    .filter(event => isNewlyPlacedOrder(event) && !!process.env.EMAIL_ORDER_NOTIFY_ADDRESS?.trim())
    .loadData(loadPlacedOrderData)
    .setRecipient(() => process.env.EMAIL_ORDER_NOTIFY_ADDRESS!.trim())
    .setFrom('{{ fromAddress }}')
    .setLanguageCode(() => LanguageCode.cs)
    .setSubject('Nová objednávka {{ order.code }}')
    .setTemplateVars(event => ({
        order: event.order,
        shippingLines: event.data.shippingLines,
        paymentLines: event.data.paymentLines,
    }));

export const shopEmailHandlers = [
    orderConfirmationHandler,
    orderAvisoHandler,
    orderStatusCustomerHandler,
    orderStatusAvisoHandler,
    emailVerificationHandler
        .setLanguageCode(() => LanguageCode.cs)
        .setSubject('Ověření e-mailové adresy'),
    passwordResetHandler
        .setLanguageCode(() => LanguageCode.cs)
        .setSubject('Obnovení hesla'),
    emailAddressChangeHandler
        .setLanguageCode(() => LanguageCode.cs)
        .setSubject('Ověření změny e-mailu'),
];
