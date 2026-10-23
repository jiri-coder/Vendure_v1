import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductDetailFields1791740000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsBrand" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsSeries" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsParameters" text`);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsEan" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsRecommendedprice" integer`);
        await queryRunner.query(
            `CREATE TABLE "product_custom_fields_downloads_asset" ("productId" integer NOT NULL, "assetId" integer NOT NULL, CONSTRAINT "PK_product_custom_fields_downloads_asset" PRIMARY KEY ("productId", "assetId"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_61e9196e6f224f8441a411d868" ON "product_custom_fields_downloads_asset" ("productId")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_943fe9f9b05690770aea435160" ON "product_custom_fields_downloads_asset" ("assetId")`,
        );
        await queryRunner.query(
            `ALTER TABLE "product_custom_fields_downloads_asset" ADD CONSTRAINT "FK_61e9196e6f224f8441a411d8680" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
        );
        await queryRunner.query(
            `ALTER TABLE "product_custom_fields_downloads_asset" ADD CONSTRAINT "FK_943fe9f9b05690770aea435160d" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "product_custom_fields_downloads_asset" DROP CONSTRAINT "FK_943fe9f9b05690770aea435160d"`,
        );
        await queryRunner.query(
            `ALTER TABLE "product_custom_fields_downloads_asset" DROP CONSTRAINT "FK_61e9196e6f224f8441a411d8680"`,
        );
        await queryRunner.query(`DROP INDEX "public"."IDX_943fe9f9b05690770aea435160"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_61e9196e6f224f8441a411d868"`);
        await queryRunner.query(`DROP TABLE "product_custom_fields_downloads_asset"`);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsRecommendedprice"`);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsEan"`);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsParameters"`);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsSeries"`);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsBrand"`);
    }
}
