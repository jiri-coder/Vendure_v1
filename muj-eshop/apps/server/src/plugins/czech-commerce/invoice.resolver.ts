import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import {
    Allow,
    ConfigService,
    Ctx,
    ForbiddenError,
    LogLevel,
    Order,
    OrderService,
    Permission,
    RequestContext,
    Transaction,
} from '@vendure/core';
import { gql } from 'graphql-tag';
import { InvoiceService, invoiceToGraphql } from './invoice.service';

export const shopInvoiceShopApiExtensions = gql`
    type ShopInvoiceLine {
        id: ID!
        description: String!
        quantity: Int!
        unitPriceWithTax: Money!
        taxRate: Float!
        lineTotalWithTax: Money!
    }

    type ShopInvoice {
        id: ID!
        number: String!
        issuedAt: DateTime!
        currencyCode: String!
        totalWithTax: Money!
        lines: [ShopInvoiceLine!]!
    }

    extend type Order {
        shopInvoice: ShopInvoice
    }

    extend type Query {
        shopInvoicePdf(orderCode: String!): String
    }
`;

export const shopInvoiceAdminApiExtensions = gql`
    type ShopInvoiceLine {
        id: ID!
        description: String!
        quantity: Int!
        unitPriceWithTax: Money!
        taxRate: Float!
        lineTotalWithTax: Money!
    }

    type ShopInvoice {
        id: ID!
        number: String!
        issuedAt: DateTime!
        currencyCode: String!
        totalWithTax: Money!
        lines: [ShopInvoiceLine!]!
    }

    input ShopInvoiceLineInput {
        id: ID
        description: String!
        quantity: Int!
        unitPriceWithTax: Money!
        taxRate: Float!
    }

    extend type Order {
        shopInvoice: ShopInvoice
    }

    extend type Query {
        shopInvoicePdf(orderId: ID!): String
    }

    extend type Mutation {
        createShopInvoice(orderId: ID!): ShopInvoice!
        updateShopInvoiceLines(id: ID!, lines: [ShopInvoiceLineInput!]!): ShopInvoice!
    }
`;

@Resolver('Order')
export class ShopInvoiceOrderResolver {
    constructor(private readonly invoiceService: InvoiceService) {}

    @ResolveField()
    async shopInvoice(@Ctx() ctx: RequestContext, @Parent() order: Order) {
        const invoice = await this.invoiceService.findByOrderId(ctx, order.id);
        return invoice ? invoiceToGraphql(invoice) : null;
    }
}

@Resolver()
export class ShopInvoiceShopResolver {
    constructor(
        private readonly invoiceService: InvoiceService,
        private readonly orderService: OrderService,
        private readonly configService: ConfigService,
    ) {}

    @Query()
    async shopInvoicePdf(
        @Ctx() ctx: RequestContext,
        @Args() args: { orderCode: string },
    ): Promise<string | null> {
        const order = await this.orderService.findOneByCode(ctx, args.orderCode, [
            'customer',
            'customer.user',
        ]);
        const canAccess =
            !!order &&
            (await this.configService.orderOptions.orderByCodeAccessStrategy.canAccessOrder(ctx, order));
        if (!order || !canAccess) {
            throw new ForbiddenError(LogLevel.Verbose);
        }
        try {
            const { pdf } = await this.invoiceService.pdfBuffer(ctx, order.id);
            return pdf.toString('base64');
        } catch {
            return null;
        }
    }
}

@Resolver()
export class ShopInvoiceAdminResolver {
    constructor(private readonly invoiceService: InvoiceService) {}

    @Query()
    @Allow(Permission.ReadOrder)
    async shopInvoicePdf(
        @Ctx() ctx: RequestContext,
        @Args() args: { orderId: string },
    ): Promise<string | null> {
        const { pdf } = await this.invoiceService.pdfBuffer(ctx, args.orderId);
        return pdf.toString('base64');
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async createShopInvoice(@Ctx() ctx: RequestContext, @Args() args: { orderId: string }) {
        const invoice = await this.invoiceService.ensureInvoice(ctx, args.orderId);
        return invoiceToGraphql(invoice);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateOrder)
    async updateShopInvoiceLines(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; lines: Array<{
            id?: string;
            description: string;
            quantity: number;
            unitPriceWithTax: number;
            taxRate: number;
        }> },
    ) {
        const invoice = await this.invoiceService.updateLines(ctx, args.id, args.lines);
        return invoiceToGraphql(invoice);
    }
}
