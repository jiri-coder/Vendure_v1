import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductCategories1791754000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsPrimarycategoryid" integer`);
        await queryRunner.query(
            `CREATE TABLE "product_custom_fields_categories_collection" ("productId" integer NOT NULL, "collectionId" integer NOT NULL, CONSTRAINT "PK_8cfdda98e1b960ee437bc9cc773" PRIMARY KEY ("productId", "collectionId"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_8323e17dac4e702a5ef5670fcd" ON "product_custom_fields_categories_collection" ("productId")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_f24009943a8f4ba4e13bf6fd7d" ON "product_custom_fields_categories_collection" ("collectionId")`,
        );
        await queryRunner.query(
            `ALTER TABLE "product_custom_fields_categories_collection" ADD CONSTRAINT "FK_8323e17dac4e702a5ef5670fcd1" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
        );
        await queryRunner.query(
            `ALTER TABLE "product_custom_fields_categories_collection" ADD CONSTRAINT "FK_f24009943a8f4ba4e13bf6fd7d4" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
        );
        await queryRunner.query(
            `ALTER TABLE "product" ADD CONSTRAINT "FK_product_primary_category" FOREIGN KEY ("customFieldsPrimarycategoryid") REFERENCES "collection"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product" DROP CONSTRAINT "FK_product_primary_category"`);
        await queryRunner.query(
            `ALTER TABLE "product_custom_fields_categories_collection" DROP CONSTRAINT "FK_f24009943a8f4ba4e13bf6fd7d4"`,
        );
        await queryRunner.query(
            `ALTER TABLE "product_custom_fields_categories_collection" DROP CONSTRAINT "FK_8323e17dac4e702a5ef5670fcd1"`,
        );
        await queryRunner.query(`DROP INDEX "public"."IDX_f24009943a8f4ba4e13bf6fd7d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8323e17dac4e702a5ef5670fcd"`);
        await queryRunner.query(`DROP TABLE "product_custom_fields_categories_collection"`);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsPrimarycategoryid"`);
    }
}
