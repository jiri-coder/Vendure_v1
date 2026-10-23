import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductCatalogFields1791753000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsWarranty" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsWeightkg" double precision`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsWeightkg"`);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsWarranty"`);
    }
}
