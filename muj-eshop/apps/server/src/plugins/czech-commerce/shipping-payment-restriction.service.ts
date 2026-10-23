import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
    ChannelService,
    ConfigService,
    Logger,
    PaymentMethod,
    PaymentMethodService,
    ProcessContext,
    RequestContext,
    RequestContextService,
    TransactionalConnection,
    User,
} from '@vendure/core';
const ALLOWED_PAYMENTS_TABLE =
    'shipping_method_custom_fields_allowed_payment_methods_payment_method';

const INELIGIBLE_MESSAGE = 'Zvolený způsob platby není dostupný pro vybranou dopravu.';

@Injectable()
export class ShippingPaymentRestrictionService implements OnApplicationBootstrap {
    constructor(
        private readonly connection: TransactionalConnection,
        private readonly processContext: ProcessContext,
        private readonly channelService: ChannelService,
        private readonly configService: ConfigService,
        private readonly requestContextService: RequestContextService,
        private readonly paymentMethodService: PaymentMethodService,
    ) {}

    async onApplicationBootstrap() {
        if (!this.processContext.isServer) {
            return;
        }

        const channel = await this.channelService.getDefaultChannel();
        const superadmin = await this.connection.rawConnection.getRepository(User).findOne({
            where: {
                identifier: this.configService.authOptions.superadminCredentials.identifier,
            },
            relations: { roles: { channels: true } },
        });
        if (!superadmin) {
            return;
        }

        const ctx = await this.requestContextService.create({
            apiType: 'admin',
            channelOrToken: channel,
            user: superadmin,
        });
        const methods = await this.paymentMethodService.findAll(ctx, { take: 100 });
        for (const method of methods.items) {
            if (method.checker) {
                continue;
            }
            await this.paymentMethodService.update(ctx, {
                id: method.id,
                checker: {
                    code: 'czech-payment-policy',
                    arguments: [
                        { name: 'paymentType', value: paymentTypeForHandler(method.handler.code) },
                        { name: 'maximumOrderTotal', value: '0' },
                    ],
                },
            });
            Logger.info(
                `Platební metodě ${method.code} byl nastaven kontrolor dostupnosti podle dopravy.`,
                'ShippingPaymentRestriction',
            );
        }
    }

    async allowedPaymentMethodIdsForOrder(ctx: RequestContext, order: unknown): Promise<string[] | null> {
        const shippingMethodIds = shippingLineMethodIds(order);
        if (shippingMethodIds.length === 0) {
            return null;
        }
        const postgres = this.connection.rawConnection.options.type === 'postgres';
        const intersection: string[][] = [];
        for (const shippingMethodId of shippingMethodIds) {
            const sql = postgres
                ? `SELECT "paymentMethodId" AS id FROM "${ALLOWED_PAYMENTS_TABLE}" WHERE "shippingMethodId" = $1`
                : `SELECT paymentMethodId AS id FROM ${ALLOWED_PAYMENTS_TABLE} WHERE shippingMethodId = ?`;
            const rows = await this.connection
                .getRepository(ctx, PaymentMethod)
                .manager.query(sql, [shippingMethodId]) as Array<{ id: string | number }>;
            if (rows.length === 0) {
                continue;
            }
            intersection.push(rows.map(row => String(row.id)));
        }
        if (intersection.length === 0) {
            return null;
        }
        return intersection.reduce((current, next) => current.filter(id => next.includes(id)));
    }

    applyToQuotes<T extends { id: string | number; isEligible: boolean; eligibilityMessage?: string | null }>(
        quotes: T[],
        allowedPaymentIds: string[] | null,
    ): T[] {
        if (!allowedPaymentIds) {
            return quotes;
        }
        return quotes.map(quote => {
            if (allowedPaymentIds.includes(String(quote.id))) {
                return quote;
            }
            return {
                ...quote,
                isEligible: false,
                eligibilityMessage: INELIGIBLE_MESSAGE,
            };
        });
    }
}

export function shippingLineMethodIds(order: unknown): string[] {
    const typedOrder = order as {
        shippingLines?: Array<{
            shippingMethodId?: string | number | null;
            shippingMethod?: { id?: string | number };
        }>;
    };
    return (typedOrder.shippingLines ?? [])
        .map(line => line.shippingMethodId ?? line.shippingMethod?.id)
        .filter((id): id is string | number => id != null)
        .map(id => String(id));
}

function paymentTypeForHandler(handlerCode: string): string {
    if (handlerCode.includes('cash-on-delivery')) {
        return 'COD';
    }
    if (handlerCode.includes('bank-transfer')) {
        return 'BANK_TRANSFER';
    }
    if (handlerCode.includes('pay-at-pickup') || handlerCode.includes('pickup')) {
        return 'PAY_AT_PICKUP';
    }
    return 'ONLINE_CARD';
}
