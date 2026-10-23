import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceDummyPaymentHandler1791711200000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE "payment_method"
             SET "code" = ?,
                 "handler" = ?
             WHERE "code" = ?
               AND "handler" LIKE ?`,
            [
                'bank-transfer',
                JSON.stringify({
                    code: 'bank-transfer-payment-handler',
                    args: [],
                }),
                'standard-payment',
                '%"code":"dummy-payment-handler"%',
            ],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE "payment_method"
             SET "code" = ?,
                 "handler" = ?
             WHERE "code" = ?
               AND "handler" LIKE ?`,
            [
                'standard-payment',
                JSON.stringify({
                    code: 'dummy-payment-handler',
                    args: [
                        {
                            name: 'automaticSettle',
                            value: 'false',
                        },
                    ],
                }),
                'bank-transfer',
                '%"code":"bank-transfer-payment-handler"%',
            ],
        );
    }
}
