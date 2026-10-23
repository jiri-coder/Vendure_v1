import { MigrationInterface, QueryRunner } from 'typeorm';

export class StockMovementLedgerOrigin1791810000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "stock_movement" ADD "customFieldsLedgerorigin" varchar(255)`,
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stock_movement" DROP COLUMN "customFieldsLedgerorigin"`);
    }
}
