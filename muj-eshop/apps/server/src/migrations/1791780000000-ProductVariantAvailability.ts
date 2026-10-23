import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductVariantAvailability1791780000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsAvailability" varchar(255)`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsAvailability"`);
    }
}
