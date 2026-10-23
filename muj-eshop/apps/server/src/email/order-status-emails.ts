import {
    EmailEventListener,
    shippingLinesWithMethod,
    transformOrderLineAssetUrls,
} from '@vendure/email-plugin';
import {
    EntityHydrator,
    Injector,
    LanguageCode,
    OrderStateTransitionEvent,
} from '@vendure/core';
import {
    orderHasSettledPayment,
    PAYMENT_ADJUSTMENT_SKU_PREFIX,
} from '../plugins/czech-commerce/manual-payment-handlers';
import { customerTrackingNumber, customerTrackingUrl } from './shipment-tracking';

const FULFILLMENT_INFO =
    'Objednávku nyní kompletujeme a následně odešleme. O předání zásilky dopravci vás budeme informovat e-mailem.';

function shopNotifyAddress(): string {
    return process.env.EMAIL_ORDER_NOTIFY_ADDRESS?.trim() ?? '';
}

function invoiceSeller() {
    return {
        name: process.env.INVOICE_SELLER_NAME?.trim() || process.env.SITE_NAME || 'koupelny-eshop',
        address: process.env.INVOICE_SELLER_ADDRESS?.trim() || '',
        ico: process.env.INVOICE_SELLER_ICO?.trim() || '',
        dic: process.env.INVOICE_SELLER_DIC?.trim() || '',
    };
}

function isPaidCustomerEmail(event: OrderStateTransitionEvent): boolean {
    return event.toState === 'PaymentSettled' && !!event.order.customer;
}

function isProcessingCustomerEmail(event: OrderStateTransitionEvent): boolean {
    return (
        event.toState === 'Processing' &&
        !!event.order.customer &&
        !orderHasSettledPayment(event.order)
    );
}

function isShippedOrCancelledEmail(event: OrderStateTransitionEvent): boolean {
    return (
        !!event.order.customer &&
        (event.toState === 'Shipped' ||
            event.toState === 'PartiallyShipped' ||
            event.toState === 'Cancelled')
    );
}

function isCustomerStatusEmail(event: OrderStateTransitionEvent): boolean {
    return (
        isPaidCustomerEmail(event) ||
        isProcessingCustomerEmail(event) ||
        isShippedOrCancelledEmail(event)
    );
}

async function loadOrderStatusData({
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
            'fulfillments',
        ],
    });
    transformOrderLineAssetUrls(event.ctx, event.order, injector);

    const toState = event.toState;
    const alreadyShipped =
        event.fromState === 'Shipped' ||
        event.fromState === 'PartiallyShipped' ||
        event.fromState === 'Delivered' ||
        event.fromState === 'PartiallyDelivered';

    const showInvoice = toState === 'PaymentSettled';
    const showFulfillmentInfo =
        (toState === 'PaymentSettled' && !alreadyShipped) || toState === 'Processing';
    const showShipments = toState === 'Shipped' || toState === 'PartiallyShipped';

    const title =
        toState === 'PaymentSettled'
            ? 'Zaplaceno'
            : toState === 'Processing'
              ? 'Vyřizováno'
              : toState === 'PartiallyShipped'
                ? 'Částečně odesláno'
                : toState === 'Shipped'
                  ? 'Odesláno'
                  : 'Zrušeno';

    const customerIntro =
        toState === 'PaymentSettled'
            ? 'děkujeme za platbu.'
            : toState === 'Processing'
              ? 'děkujeme za objednávku na dobírku.'
              : toState === 'Cancelled'
                ? 'vaše objednávka byla zrušena.'
                : toState === 'PartiallyShipped'
                  ? 'část vaší objednávky byla odeslána.'
                  : 'vaše objednávka byla odeslána.';

    const shopIntro =
        toState === 'PaymentSettled'
            ? 'Platba k objednávce byla přijata.'
            : toState === 'Processing'
              ? 'Objednávka na dobírku se vyřizuje.'
              : toState === 'Cancelled'
                ? 'Objednávka byla zrušena.'
                : toState === 'PartiallyShipped'
                  ? 'Objednávka byla částečně odeslána.'
                  : 'Objednávka byla odeslána.';

    const surcharges = event.order.surcharges ?? [];
    const paymentLines = (event.order.payments ?? [])
        .filter(payment => payment.state === 'Authorized' || payment.state === 'Settled')
        .map(payment => {
            const metadata = payment.metadata as { public?: { methodName?: string } } | undefined;
            const adjustmentSkuPrefix = `${PAYMENT_ADJUSTMENT_SKU_PREFIX}:${payment.method}`;
            const surcharge = surcharges.find(item => item.sku.startsWith(adjustmentSkuPrefix));
            return {
                name: metadata?.public?.methodName?.trim() || payment.method,
                priceWithTax: surcharge?.priceWithTax ?? 0,
            };
        });

    const shipments = (event.order.fulfillments ?? [])
        .filter(fulfillment => fulfillment.state !== 'Cancelled')
        .map(fulfillment => {
            const trackingCode = fulfillment.trackingCode ?? '';
            const trackingNumber = customerTrackingNumber(trackingCode);
            return {
                method: fulfillment.method,
                trackingNumber,
                trackingUrl: customerTrackingUrl(trackingCode, fulfillment.method ?? ''),
            };
        })
        .filter(shipment => shipment.method || shipment.trackingNumber);

    const billing = event.order.billingAddress?.streetLine1
        ? event.order.billingAddress
        : event.order.shippingAddress;
    const storefrontUrl = (process.env.STOREFRONT_URL || 'http://localhost:3001').replace(/\/$/, '');

    return {
        title,
        customerIntro,
        shopIntro,
        showInvoice,
        showFulfillmentInfo,
        fulfillmentInfo: FULFILLMENT_INFO,
        showShipments,
        shipments,
        shippingLines: shippingLinesWithMethod(event.order),
        paymentLines,
        seller: invoiceSeller(),
        billing,
        orderAccountUrl: `${storefrontUrl}/cs/account/orders/${event.order.code}`,
    };
}

export const orderStatusCustomerHandler = new EmailEventListener('order-status')
    .on(OrderStateTransitionEvent)
    .filter(isCustomerStatusEmail)
    .loadData(loadOrderStatusData)
    .setRecipient(event => event.order.customer!.emailAddress)
    .setFrom('{{ fromAddress }}')
    .setLanguageCode(() => LanguageCode.cs)
    .setSubject('{{ title }} — {{ order.code }}')
    .setTemplateVars(event => ({
        order: event.order,
        title: event.data.title,
        intro: event.data.customerIntro,
        showInvoice: event.data.showInvoice,
        showFulfillmentInfo: event.data.showFulfillmentInfo,
        fulfillmentInfo: event.data.fulfillmentInfo,
        showShipments: event.data.showShipments,
        shipments: event.data.shipments,
        shippingLines: event.data.shippingLines,
        paymentLines: event.data.paymentLines,
        seller: event.data.seller,
        billing: event.data.billing,
        orderAccountUrl: event.data.orderAccountUrl,
    }));

export const orderStatusAvisoHandler = new EmailEventListener('order-status-aviso')
    .on(OrderStateTransitionEvent)
    .filter(event => isCustomerStatusEmail(event) && !!shopNotifyAddress())
    .loadData(loadOrderStatusData)
    .setRecipient(() => shopNotifyAddress())
    .setFrom('{{ fromAddress }}')
    .setLanguageCode(() => LanguageCode.cs)
    .setSubject('{{ title }} — {{ order.code }}')
    .setTemplateVars(event => ({
        order: event.order,
        title: event.data.title,
        intro: event.data.shopIntro,
        showInvoice: event.data.showInvoice,
        showFulfillmentInfo: event.data.showFulfillmentInfo,
        fulfillmentInfo: event.data.fulfillmentInfo,
        showShipments: event.data.showShipments,
        shipments: event.data.shipments,
        shippingLines: event.data.shippingLines,
        paymentLines: event.data.paymentLines,
        seller: event.data.seller,
        billing: event.data.billing,
        orderAccountUrl: event.data.orderAccountUrl,
    }));
