import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductVariantParameters1791770000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsParameters" text`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsParameters"`);
    }
}
