import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { StockMovementType } from '@vendure/common/lib/generated-types';
import {
    Allocation,
    Cancellation,
    Ctx,
    EventBus,
    OrderLine,
    Release,
    RequestContext,
    Sale,
    StockAdjustment,
    StockMovement,
    StockMovementEvent,
    TransactionalConnection,
} from '@vendure/core';

export const STOCK_LEDGER_ORIGIN_ADMIN = 'admin';
export const STOCK_LEDGER_ORIGIN_IMPORT = 'import';

const stockImportContext = new AsyncLocalStorage<boolean>();

/**
 * Nightly stock imports must run inside this helper so their ADJUSTMENT rows
 * stay out of the ProductVariant stock ledger. Admin UI changes are left visible.
 */
export function runStockImport<T>(fn: () => T): T {
    return stockImportContext.run(true, fn);
}

export function isStockImportRunning(): boolean {
    return stockImportContext.getStore() === true;
}

type MovementWithOrderLine = typeof Sale | typeof Release | typeof Allocation | typeof Cancellation;

async function loadOrderLine(
    connection: TransactionalConnection,
    ctx: RequestContext,
    entity: MovementWithOrderLine,
    id: string | number,
    label: string,
): Promise<OrderLine> {
    const movement = await connection.getRepository(ctx, entity).findOne({
        where: { id },
        relations: ['orderLine', 'orderLine.order'],
    });
    if (!movement?.orderLine) {
        throw new Error(`${label} ${id} is missing orderLine`);
    }
    return movement.orderLine;
}

function existingOrderLine(parent: { orderLine?: OrderLine }): OrderLine | undefined {
    return parent.orderLine?.order ? parent.orderLine : undefined;
}

@Resolver('Sale')
export class SaleOrderLineResolver {
    constructor(private readonly connection: TransactionalConnection) {}

    @ResolveField()
    async orderLine(@Ctx() ctx: RequestContext, @Parent() sale: Sale): Promise<OrderLine> {
        return existingOrderLine(sale) ?? loadOrderLine(this.connection, ctx, Sale, sale.id, 'Sale');
    }
}

@Resolver('Release')
export class ReleaseOrderLineResolver {
    constructor(private readonly connection: TransactionalConnection) {}

    @ResolveField()
    async orderLine(@Ctx() ctx: RequestContext, @Parent() release: Release): Promise<OrderLine> {
        return existingOrderLine(release) ?? loadOrderLine(this.connection, ctx, Release, release.id, 'Release');
    }
}

@Resolver('Allocation')
export class AllocationOrderLineResolver {
    constructor(private readonly connection: TransactionalConnection) {}

    @ResolveField()
    async orderLine(@Ctx() ctx: RequestContext, @Parent() allocation: Allocation): Promise<OrderLine> {
        return (
            existingOrderLine(allocation) ??
            loadOrderLine(this.connection, ctx, Allocation, allocation.id, 'Allocation')
        );
    }
}

@Resolver('Cancellation')
export class CancellationOrderLineResolver {
    constructor(private readonly connection: TransactionalConnection) {}

    @ResolveField()
    async orderLine(@Ctx() ctx: RequestContext, @Parent() cancellation: Cancellation): Promise<OrderLine> {
        return (
            existingOrderLine(cancellation) ??
            loadOrderLine(this.connection, ctx, Cancellation, cancellation.id, 'Cancellation')
        );
    }
}

@Injectable()
export class StockLedgerOriginService implements OnModuleInit {
    constructor(
        private readonly eventBus: EventBus,
        private readonly connection: TransactionalConnection,
    ) {}

    onModuleInit() {
        this.eventBus.registerBlockingEventHandler({
            event: StockMovementEvent,
            id: 'tag-stock-adjustment-ledger-origin',
            handler: event => this.tagAdjustments(event),
        });
    }

    private async tagAdjustments(event: StockMovementEvent): Promise<void> {
        const origin = isStockImportRunning() ? STOCK_LEDGER_ORIGIN_IMPORT : STOCK_LEDGER_ORIGIN_ADMIN;
        const adjustments = event.stockMovements.filter(
            (movement): movement is StockAdjustment => movement.type === StockMovementType.ADJUSTMENT,
        );
        for (const adjustment of adjustments) {
            const customFields = {
                ...(adjustment.customFields ?? {}),
                ledgerOrigin: origin,
            } as StockMovement['customFields'] & { ledgerOrigin: string };
            adjustment.customFields = customFields;
            await this.connection.getRepository(event.ctx, StockAdjustment).save(adjustment, { reload: false });
        }
    }
}
