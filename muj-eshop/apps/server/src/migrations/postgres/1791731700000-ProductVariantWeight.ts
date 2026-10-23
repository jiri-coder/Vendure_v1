import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductVariantWeight1791731700000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "product_variant" ADD "customFieldsWeightkg" double precision DEFAULT '0'`,
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "product_variant" DROP COLUMN "customFieldsWeightkg"`,
        );
    }
}
