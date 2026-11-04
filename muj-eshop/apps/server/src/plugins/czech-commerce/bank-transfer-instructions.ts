import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import {
    Ctx,
    EntityHydrator,
    Logger,
    Order,
    Payment,
    RequestContext,
} from '@vendure/core';
import { gql } from 'graphql-tag';
import { paymentPublicKind } from './manual-payment-handlers';

const loggerCtx = 'BankTransferInstructions';
const QR_IMAGE_SIZE = 200;

export const bankTransferShopApiExtensions = gql`
    type BankTransferPaymentInstructions {
        accountName: String!
        accountNumber: String!
        iban: String!
        bankName: String
        variableSymbol: String!
        amount: Money!
        currencyCode: String!
        message: String!
        spdPayload: String!
    }

    extend type Order {
        bankTransferInstructions: BankTransferPaymentInstructions
    }
`;

export interface BankTransferInstructionsView {
    accountName: string;
    accountNumber: string;
    iban: string;
    bankName: string | null;
    variableSymbol: string;
    amount: number;
    currencyCode: string;
    message: string;
    spdPayload: string;
    qrImageUrl: string;
}

interface BankAccountConfig {
    iban: string;
    accountName: string;
    bankName: string | null;
}

function envValue(name: string): string {
    return process.env[name]?.trim() ?? '';
}

export function readBankAccountConfig(): BankAccountConfig | undefined {
    const iban = normalizeIban(envValue('BANK_ACCOUNT_IBAN'));
    if (!iban) {
        return undefined;
    }
    if (!isValidIban(iban)) {
        Logger.error(
            `BANK_ACCOUNT_IBAN is set but is not a valid IBAN. QR platba will not be generated.`,
            loggerCtx,
        );
        return undefined;
    }
    const accountName =
        envValue('BANK_ACCOUNT_NAME') ||
        envValue('INVOICE_SELLER_NAME') ||
        envValue('SITE_NAME') ||
        'Sanitrade s.r.o.';
    return {
        iban,
        accountName,
        bankName: envValue('BANK_ACCOUNT_BANK') || null,
    };
}

export function normalizeIban(value: string): string {
    return value.replace(/\s+/g, '').toUpperCase();
}

export function isValidIban(iban: string): boolean {
    const compact = normalizeIban(iban);
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) {
        return false;
    }
    const rearranged = compact.slice(4) + compact.slice(0, 4);
    const numeric = rearranged.replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));
    let remainder = 0;
    for (const digit of numeric) {
        remainder = (remainder * 10 + Number(digit)) % 97;
    }
    return remainder === 1;
}

export function czechAccountNumberFromIban(iban: string): string {
    const compact = normalizeIban(iban);
    if (!compact.startsWith('CZ') || compact.length !== 24) {
        return compact;
    }
    const bankCode = compact.slice(4, 8);
    const prefix = compact.slice(8, 14).replace(/^0+/, '');
    const account = compact.slice(14, 24).replace(/^0+/, '') || '0';
    return prefix ? `${prefix}-${account}/${bankCode}` : `${account}/${bankCode}`;
}

export function variableSymbolForOrder(order: Pick<Order, 'id' | 'code'>): string {
    const fromId = digitsForVariableSymbol(String(order.id));
    if (fromId) {
        return fromId;
    }
    const fromCode = digitsForVariableSymbol(order.code);
    if (fromCode) {
        return fromCode;
    }
    let hash = 0;
    for (const char of order.code) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    const fallback = String(hash % 10_000_000_000);
    return fallback === '0' ? '1' : fallback;
}

function digitsForVariableSymbol(value: string): string | undefined {
    const digits = value.replace(/\D/g, '').replace(/^0+/, '').slice(-10);
    return digits || undefined;
}

function spdValue(value: string, maxLength: number): string {
    return value.replace(/\*/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function buildSpdPayload(input: {
    iban: string;
    amount: number;
    currencyCode: string;
    variableSymbol: string;
    message: string;
    accountName: string;
}): string {
    const amountMajor = (input.amount / 100).toFixed(2);
    return [
        'SPD',
        '1.0',
        `ACC:${normalizeIban(input.iban)}`,
        `AM:${amountMajor}`,
        `CC:${spdValue(input.currencyCode, 3)}`,
        `X-VS:${spdValue(input.variableSymbol, 10)}`,
        `MSG:${spdValue(input.message, 60)}`,
        `RN:${spdValue(input.accountName, 35)}`,
    ].join('*');
}

export function spdQrImageUrl(payload: string): string {
    const params = new URLSearchParams({
        size: `${QR_IMAGE_SIZE}x${QR_IMAGE_SIZE}`,
        data: payload,
    });
    return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}

function isOpenBankTransferPayment(payment: Payment): boolean {
    if (
        payment.state === 'Cancelled' ||
        payment.state === 'Declined' ||
        payment.state === 'Error' ||
        payment.state === 'Settled'
    ) {
        return false;
    }
    return (
        payment.method === 'bank-transfer' || paymentPublicKind(payment) === 'BANK_TRANSFER'
    );
}

export async function buildBankTransferInstructions(
    order: Order,
): Promise<BankTransferInstructionsView | undefined> {
    const payments = order.payments ?? [];
    if (!payments.some(isOpenBankTransferPayment)) {
        return undefined;
    }
    const account = readBankAccountConfig();
    if (!account) {
        Logger.warn(
            `Order ${order.code} is awaiting a bank transfer, but BANK_ACCOUNT_IBAN is not configured.`,
            loggerCtx,
        );
        return undefined;
    }
    const variableSymbol = variableSymbolForOrder(order);
    const message = `Objednavka ${order.code}`;
    const payload = buildSpdPayload({
        iban: account.iban,
        amount: order.totalWithTax,
        currencyCode: order.currencyCode,
        variableSymbol,
        message,
        accountName: account.accountName,
    });
    const instructions: BankTransferInstructionsView = {
        accountName: account.accountName,
        accountNumber: czechAccountNumberFromIban(account.iban),
        iban: account.iban,
        bankName: account.bankName,
        variableSymbol,
        amount: order.totalWithTax,
        currencyCode: order.currencyCode,
        message,
        spdPayload: payload,
        qrImageUrl: spdQrImageUrl(payload),
    };
    return instructions;
}

@Resolver('Order')
export class BankTransferInstructionsResolver {
    constructor(private readonly entityHydrator: EntityHydrator) {}

    @ResolveField()
    async bankTransferInstructions(
        @Ctx() ctx: RequestContext,
        @Parent() order: Order,
    ): Promise<BankTransferInstructionsView | null> {
        if (!order.payments) {
            await this.entityHydrator.hydrate(ctx, order, { relations: ['payments'] });
        }
        return (await buildBankTransferInstructions(order)) ?? null;
    }
}
