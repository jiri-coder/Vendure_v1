import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductMerchandising1791755000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsIsnew" boolean NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsOnsale" boolean NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsAvailability" varchar(255)`);
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsVideos" text`);
        await queryRunner.query(
            `CREATE TABLE "product_custom_fields_related_products_product" ("productId_1" integer NOT NULL, "productId_2" integer NOT NULL, CONSTRAINT "FK_9501c38d46f1511e055040e49cf" FOREIGN KEY ("productId_1") REFERENCES "product" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_324ff4d16355fa1a7f3dca18cb3" FOREIGN KEY ("productId_2") REFERENCES "product" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "PK_8dee33aa3c00a899f56e9343f95" PRIMARY KEY ("productId_1", "productId_2"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_9501c38d46f1511e055040e49c" ON "product_custom_fields_related_products_product" ("productId_1")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_324ff4d16355fa1a7f3dca18cb" ON "product_custom_fields_related_products_product" ("productId_2")`,
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_324ff4d16355fa1a7f3dca18cb"`);
        await queryRunner.query(`DROP INDEX "IDX_9501c38d46f1511e055040e49c"`);
        await queryRunner.query(`DROP TABLE "product_custom_fields_related_products_product"`);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsVideos"`);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsAvailability"`);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsOnsale"`);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsIsnew"`);
    }
}
