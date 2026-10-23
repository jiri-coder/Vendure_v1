import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { HistoryEntryType } from '@vendure/common/lib/generated-types';
import {
    Ctx,
    Order,
    OrderHistoryEntry,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import { gql } from 'graphql-tag';

export const orderHasNoteAdminApiExtensions = gql`
    extend type Order {
        hasNote: Boolean!
    }

    extend type Sale {
        orderLine: OrderLine!
    }

    extend type Release {
        orderLine: OrderLine!
    }
`;

type NoteFlagBatch = {
    ids: Set<string>;
    waiters: Array<{ id: string; resolve: (value: boolean) => void; reject: (error: unknown) => void }>;
    scheduled: boolean;
};

const noteFlagBatches = new WeakMap<RequestContext, NoteFlagBatch>();

@Resolver('Order')
export class OrderHasNoteResolver {
    constructor(private readonly connection: TransactionalConnection) {}

    @ResolveField()
    hasNote(@Ctx() ctx: RequestContext, @Parent() order: Order): Promise<boolean> {
        const orderId = String(order.id);
        let batch = noteFlagBatches.get(ctx);
        if (!batch) {
            batch = { ids: new Set(), waiters: [], scheduled: false };
            noteFlagBatches.set(ctx, batch);
        }
        batch.ids.add(orderId);
        const result = new Promise<boolean>((resolve, reject) => {
            batch.waiters.push({ id: orderId, resolve, reject });
        });
        if (!batch.scheduled) {
            batch.scheduled = true;
            queueMicrotask(() => {
                void this.flush(ctx);
            });
        }
        return result;
    }

    private async flush(ctx: RequestContext): Promise<void> {
        const batch = noteFlagBatches.get(ctx);
        if (!batch) {
            return;
        }
        noteFlagBatches.delete(ctx);
        const ids = [...batch.ids];
        try {
            const flagged = ids.length === 0 ? new Set<string>() : await this.orderIdsWithNotes(ctx, ids);
            for (const waiter of batch.waiters) {
                waiter.resolve(flagged.has(waiter.id));
            }
        } catch (error) {
            for (const waiter of batch.waiters) {
                waiter.reject(error);
            }
        }
    }

    private async orderIdsWithNotes(ctx: RequestContext, ids: string[]): Promise<Set<string>> {
        const rows = await this.connection
            .getRepository(ctx, OrderHistoryEntry)
            .createQueryBuilder('entry')
            .innerJoin('entry.order', 'order')
            .select('order.id', 'orderId')
            .where('order.id IN (:...ids)', { ids })
            .andWhere('entry.type = :type', { type: HistoryEntryType.ORDER_NOTE })
            .groupBy('order.id')
            .getRawMany<{ orderId: string | number }>();

        return new Set(rows.map(row => String(row.orderId)));
    }
}
