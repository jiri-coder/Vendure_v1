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
import { InvoiceService } from '../plugins/czech-commerce/invoice.service';
import { orderHasSettledPayment } from '../plugins/czech-commerce/manual-payment-handlers';
import { paymentLinesForEmail } from './payment-lines';
import { customerTrackingNumber, customerTrackingUrl } from './shipment-tracking';

const FULFILLMENT_INFO =
    'Objednávku nyní kompletujeme a následně odešleme. O předání zásilky dopravci vás budeme informovat e-mailem.';

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

    const paymentLines = paymentLinesForEmail(event.order);

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
    let invoiceNumber = '';
    if (showInvoice) {
        try {
            const invoice = await injector.get(InvoiceService).ensureInvoice(event.ctx, event.order);
            invoiceNumber = invoice.number;
        } catch {
            invoiceNumber = '';
        }
    }

    return {
        title,
        customerIntro,
        showInvoice,
        invoiceNumber,
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
        invoiceNumber: event.data.invoiceNumber,
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
