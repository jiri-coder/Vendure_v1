import { Injectable, OnModuleInit } from '@nestjs/common';
import {
    EventBus,
    Logger,
    Order,
    OrderLine,
    OrderService,
    OrderStateTransitionEvent,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { ShopInvoice, ShopInvoiceLine } from './invoice-entities';
import { buildInvoicePdf } from './invoice-pdf';
import { PAYMENT_ADJUSTMENT_SKU_PREFIX } from './manual-payment-handlers';
import {
    customerPaymentMethodLabel,
    paymentAdjustmentCustomerLabel,
    paymentMethodCodeFromAdjustmentSku,
} from './payment-method-labels';

const loggerCtx = 'ShopInvoice';
const invoiceOrderRelations = [
    'customer',
    'lines.productVariant.translations',
    'lines.productVariant.product.translations',
    'lines.productVariant.product.variants',
    'lines.productVariant.product.optionGroups',
    'shippingLines.shippingMethod.translations',
    'surcharges',
] as const;

export type InvoiceLineInput = {
    id?: string | number;
    description: string;
    quantity: number;
    unitPriceWithTax: number;
    taxRate: number;
};

function envText(name: string): string {
    return process.env[name]?.trim() ?? '';
}

function addressPart(value?: string | null): string {
    return value?.trim() ?? '';
}

function translatedName(entity?: {
    name?: string | null;
    translations?: Array<{ name?: string | null; languageCode?: string | null }> | null;
} | null): string {
    const direct = entity?.name?.trim() ?? '';
    if (direct) {
        return direct;
    }
    const translations = entity?.translations ?? [];
    const czech = translations.find(item => item.languageCode === 'cs');
    return (czech?.name || translations[0]?.name || '').trim();
}

function namesMatch(left: string, right: string): boolean {
    return left.trim().toLocaleLowerCase('cs') === right.trim().toLocaleLowerCase('cs');
}

function isStandaloneProduct(product?: {
    variants?: unknown[] | null;
    optionGroups?: unknown[] | null;
} | null): boolean {
    if (Array.isArray(product?.variants)) {
        return product.variants.length <= 1;
    }
    if (Array.isArray(product?.optionGroups)) {
        return product.optionGroups.length === 0;
    }
    return false;
}

function orderLineDescription(line: OrderLine): string {
    const variant = line.productVariant;
    const productName = translatedName(variant?.product);
    const variantName = translatedName(variant);
    const includeVariant =
        !!productName &&
        !!variantName &&
        !isStandaloneProduct(variant?.product) &&
        !namesMatch(productName, variantName);
    if (includeVariant) {
        return `${productName} — ${variantName}`;
    }
    return productName || variantName || 'Položka';
}

function shouldUpgradeDescription(current: string, generated: string): boolean {
    const from = current.trim();
    const to = generated.trim();
    if (!to || from === to) {
        return false;
    }
    if (from === 'Položka') {
        return true;
    }
    return to.endsWith(` — ${from}`) || to.startsWith(`${from} — `) || from.startsWith(`${to} — `);
}

@Injectable()
export class InvoiceService implements OnModuleInit {
    constructor(
        private readonly connection: TransactionalConnection,
        private readonly eventBus: EventBus,
        private readonly orderService: OrderService,
    ) {}

    onModuleInit() {
        this.eventBus.registerBlockingEventHandler({
            event: OrderStateTransitionEvent,
            id: 'create-shop-invoice-on-payment-settled',
            handler: event => this.onOrderTransition(event),
        });
    }

    private async onOrderTransition(event: OrderStateTransitionEvent): Promise<void> {
        if (event.toState !== 'PaymentSettled') {
            return;
        }
        try {
            await this.ensureInvoice(event.ctx, event.order);
        } catch (error) {
            Logger.error(
                `Failed to create invoice for order ${event.order.code}: ${
                    error instanceof Error ? error.message : String(error)
                }`,
                loggerCtx,
            );
        }
    }

    async findByOrderId(ctx: RequestContext, orderId: string | number): Promise<ShopInvoice | undefined> {
        const invoice = await this.connection.getRepository(ctx, ShopInvoice).findOne({
            where: { orderId },
            relations: ['lines'],
        });
        if (!invoice) {
            return undefined;
        }
        if (!invoice.lines?.length) {
            return this.fillLinesFromOrder(ctx, invoice);
        }
        invoice.lines.sort((a, b) => a.position - b.position);
        return this.upgradeLineDescriptions(ctx, invoice);
    }

    async ensureInvoice(ctx: RequestContext, orderOrId: Order | string | number): Promise<ShopInvoice> {
        const orderId = typeof orderOrId === 'object' ? orderOrId.id : orderOrId;
        const existing = await this.findByOrderId(ctx, orderId);
        if (existing) {
            return existing;
        }
        const order =
            (await this.orderService.findOne(ctx, orderId, [...invoiceOrderRelations])) ??
            (typeof orderOrId === 'object' ? orderOrId : undefined);
        if (!order) {
            throw new UserInputError('Order not found');
        }
        return this.createFromOrder(ctx, order);
    }

    async updateLines(
        ctx: RequestContext,
        invoiceId: string | number,
        lines: InvoiceLineInput[],
    ): Promise<ShopInvoice> {
        if (lines.length === 0) {
            throw new UserInputError('Faktura musí obsahovat alespoň jednu položku.');
        }
        const invoice = await this.connection.getRepository(ctx, ShopInvoice).findOne({
            where: { id: invoiceId },
            relations: ['lines'],
        });
        if (!invoice) {
            throw new UserInputError('Invoice not found');
        }
        return this.replaceLines(ctx, invoice, lines);
    }

    async pdfBuffer(ctx: RequestContext, orderId: string | number): Promise<{ invoice: ShopInvoice; pdf: Buffer }> {
        const invoice = await this.findByOrderId(ctx, orderId);
        if (!invoice) {
            throw new UserInputError('Invoice not found');
        }
        const pdf = await buildInvoicePdf(invoice);
        return { invoice, pdf };
    }

    private async createFromOrder(ctx: RequestContext, order: Order): Promise<ShopInvoice> {
        const billing = order.billingAddress?.streetLine1 ? order.billingAddress : order.shippingAddress;
        const customFields = (order.customFields ?? {}) as { companyIco?: string; companyDic?: string };
        const invoiceRepo = this.connection.getRepository(ctx, ShopInvoice);
        const invoice = invoiceRepo.create({
            number: await this.nextNumber(ctx),
            orderId: order.id,
            order,
            issuedAt: new Date(),
            currencyCode: order.currencyCode,
            totalWithTax: order.totalWithTax,
            sellerName: envText('INVOICE_SELLER_NAME') || envText('SITE_NAME') || 'Sanitrade s.r.o.',
            sellerAddress: envText('INVOICE_SELLER_ADDRESS'),
            sellerIco: envText('INVOICE_SELLER_ICO'),
            sellerDic: envText('INVOICE_SELLER_DIC'),
            sellerIban: envText('BANK_ACCOUNT_IBAN'),
            buyerName: [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ')
                || addressPart(billing?.fullName),
            buyerCompany: addressPart(billing?.company),
            buyerStreet: [billing?.streetLine1, billing?.streetLine2].filter(Boolean).join(', '),
            buyerCity: addressPart(billing?.city),
            buyerPostalCode: addressPart(billing?.postalCode),
            buyerCountry: addressPart(billing?.country),
            buyerIco: addressPart(customFields.companyIco),
            buyerDic: addressPart(customFields.companyDic),
            buyerEmail: order.customer?.emailAddress ?? '',
        });
        try {
            const saved = await invoiceRepo.save(invoice);
            return this.replaceLines(ctx, saved, this.linesFromOrder(order));
        } catch (error) {
            const existing = await this.connection.getRepository(ctx, ShopInvoice).findOne({
                where: { orderId: order.id },
                relations: ['lines'],
            });
            if (existing) {
                if (!existing.lines?.length) {
                    return this.fillLinesFromOrder(ctx, existing);
                }
                return existing;
            }
            throw error;
        }
    }

    private async upgradeLineDescriptions(ctx: RequestContext, invoice: ShopInvoice): Promise<ShopInvoice> {
        const order = await this.orderService.findOne(ctx, invoice.orderId, [...invoiceOrderRelations]);
        if (!order) {
            return invoice;
        }
        const generated = this.linesFromOrder(order);
        if (generated.length !== invoice.lines.length) {
            return invoice;
        }
        const nextLines = invoice.lines.map((line, index) => ({
            id: line.id,
            description: shouldUpgradeDescription(line.description, generated[index].description)
                ? generated[index].description
                : line.description,
            quantity: line.quantity,
            unitPriceWithTax: line.unitPriceWithTax,
            taxRate: line.taxRate,
        }));
        if (nextLines.every((line, index) => line.description === invoice.lines[index].description)) {
            return invoice;
        }
        return this.replaceLines(ctx, invoice, nextLines);
    }

    private async fillLinesFromOrder(ctx: RequestContext, invoice: ShopInvoice): Promise<ShopInvoice> {
        const order = await this.orderService.findOne(ctx, invoice.orderId, [...invoiceOrderRelations]);
        if (!order) {
            return invoice;
        }
        const lines = this.linesFromOrder(order);
        if (!lines.length) {
            return invoice;
        }
        return this.replaceLines(ctx, invoice, lines);
    }

    private async replaceLines(
        ctx: RequestContext,
        invoice: ShopInvoice,
        lines: InvoiceLineInput[],
    ): Promise<ShopInvoice> {
        const invoiceRepo = this.connection.getRepository(ctx, ShopInvoice);
        const lineRepo = this.connection.getRepository(ctx, ShopInvoiceLine);
        if (invoice.id != null) {
            await lineRepo.delete({ invoiceId: invoice.id });
        }
        const savedLines = await lineRepo.save(
            lines.map((line, index) =>
                lineRepo.create({
                    invoiceId: invoice.id,
                    position: index,
                    description: line.description.trim() || 'Položka',
                    quantity: Math.max(1, Math.round(line.quantity) || 1),
                    unitPriceWithTax: Math.round(line.unitPriceWithTax),
                    taxRate: Number.isFinite(line.taxRate) ? line.taxRate : 0,
                }),
            ),
        );
        invoice.lines = savedLines.sort((a, b) => a.position - b.position);
        invoice.totalWithTax = savedLines.reduce(
            (sum, line) => sum + line.quantity * line.unitPriceWithTax,
            0,
        );
        await invoiceRepo.update({ id: invoice.id }, { totalWithTax: invoice.totalWithTax });
        return invoice;
    }

    private linesFromOrder(order: Order): Array<Omit<ShopInvoiceLine, 'id' | 'createdAt' | 'updatedAt' | 'invoice' | 'invoiceId' | 'position'>> {
        const lines: Array<{
            description: string;
            quantity: number;
            unitPriceWithTax: number;
            taxRate: number;
        }> = [];

        for (const line of order.lines ?? []) {
            lines.push({
                description: orderLineDescription(line),
                quantity: line.quantity,
                unitPriceWithTax: line.proratedUnitPriceWithTax ?? line.discountedUnitPriceWithTax ?? line.unitPriceWithTax,
                taxRate: line.taxRate ?? 0,
            });
        }

        for (const shipping of order.shippingLines ?? []) {
            const shippingName =
                shipping.shippingMethod?.name ||
                shipping.shippingMethod?.translations?.[0]?.name ||
                'doprava';
            lines.push({
                description: `Doprava (${shippingName})`,
                quantity: 1,
                unitPriceWithTax: shipping.priceWithTax ?? 0,
                taxRate: shipping.taxRate ?? 0,
            });
        }

        for (const surcharge of order.surcharges ?? []) {
            if (!surcharge.sku?.startsWith(`${PAYMENT_ADJUSTMENT_SKU_PREFIX}:`)) {
                if (surcharge.priceWithTax === 0) {
                    continue;
                }
                lines.push({
                    description: surcharge.description,
                    quantity: 1,
                    unitPriceWithTax: surcharge.priceWithTax,
                    taxRate: surcharge.taxRate ?? 0,
                });
                continue;
            }
            const code = paymentMethodCodeFromAdjustmentSku(surcharge.sku) ?? '';
            const name = customerPaymentMethodLabel(code, surcharge.description);
            lines.push({
                description: paymentAdjustmentCustomerLabel(name, surcharge.priceWithTax),
                quantity: 1,
                unitPriceWithTax: surcharge.priceWithTax,
                taxRate: surcharge.taxRate ?? 0,
            });
        }

        return lines;
    }

    private async nextNumber(ctx: RequestContext): Promise<string> {
        const year = new Date().getFullYear();
        const prefix = `${year}`;
        const last = await this.connection
            .getRepository(ctx, ShopInvoice)
            .createQueryBuilder('invoice')
            .where('invoice.number LIKE :prefix', { prefix: `${prefix}%` })
            .orderBy('invoice.number', 'DESC')
            .getOne();
        const lastSeq = last ? Number(last.number.slice(prefix.length)) : 0;
        const nextSeq = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;
        return `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }
}

export function invoiceToGraphql(invoice: ShopInvoice) {
    const lines = [...(invoice.lines ?? [])].sort((a, b) => a.position - b.position);
    return {
        id: invoice.id,
        number: invoice.number,
        issuedAt: invoice.issuedAt,
        currencyCode: invoice.currencyCode,
        totalWithTax: invoice.totalWithTax,
        lines: lines.map(line => ({
            id: line.id,
            description: line.description,
            quantity: line.quantity,
            unitPriceWithTax: line.unitPriceWithTax,
            taxRate: line.taxRate,
            lineTotalWithTax: line.quantity * line.unitPriceWithTax,
        })),
    };
}
