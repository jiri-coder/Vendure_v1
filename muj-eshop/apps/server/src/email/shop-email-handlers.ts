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
    OrderStateTransitionEvent,
} from '@vendure/core';
import { orderStatusCustomerHandler } from './order-status-emails';
import { buildBankTransferInstructions } from '../plugins/czech-commerce/bank-transfer-instructions';
import { paymentLinesForEmail } from './payment-lines';

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

async function loadOrderConfirmationData({
    event,
    injector,
}: {
    event: OrderStateTransitionEvent;
    injector: Injector;
}) {
    const data = await loadPlacedOrderData({ event, injector });
    return {
        ...data,
        bankTransfer: await buildBankTransferInstructions(event.order),
    };
}

export const orderConfirmationHandler = new EmailEventListener('order-confirmation')
    .on(OrderStateTransitionEvent)
    .filter(isAwaitingPaymentConfirmation)
    .loadData(loadOrderConfirmationData)
    .setRecipient(event => event.order.customer!.emailAddress)
    .setFrom('{{ fromAddress }}')
    .setLanguageCode(() => LanguageCode.cs)
    .setSubject('Potvrzení objednávky {{ order.code }}')
    .setTemplateVars(event => ({
        order: event.order,
        shippingLines: event.data.shippingLines,
        paymentLines: event.data.paymentLines,
        bankTransfer: event.data.bankTransfer,
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
