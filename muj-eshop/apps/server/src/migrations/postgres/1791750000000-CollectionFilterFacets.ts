import { MigrationInterface, QueryRunner } from 'typeorm';

export class CollectionFilterFacets1791750000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "collection" ADD "customFields__fix_relational_custom_fields__" boolean`,
        );
        await queryRunner.query(
            `CREATE TABLE "collection_custom_fields_filter_facets_facet" ("collectionId" integer NOT NULL, "facetId" integer NOT NULL, CONSTRAINT "PK_7866308e445c3521c231b8d2f80" PRIMARY KEY ("collectionId", "facetId"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_1a7f1f42c6fee8f5ecae7ad2ed" ON "collection_custom_fields_filter_facets_facet" ("collectionId")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_dfb522820bb828b3ebbfec6a36" ON "collection_custom_fields_filter_facets_facet" ("facetId")`,
        );
        await queryRunner.query(
            `ALTER TABLE "collection_custom_fields_filter_facets_facet" ADD CONSTRAINT "FK_1a7f1f42c6fee8f5ecae7ad2edc" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
        );
        await queryRunner.query(
            `ALTER TABLE "collection_custom_fields_filter_facets_facet" ADD CONSTRAINT "FK_dfb522820bb828b3ebbfec6a363" FOREIGN KEY ("facetId") REFERENCES "facet"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "collection_custom_fields_filter_facets_facet" DROP CONSTRAINT "FK_dfb522820bb828b3ebbfec6a363"`,
        );
        await queryRunner.query(
            `ALTER TABLE "collection_custom_fields_filter_facets_facet" DROP CONSTRAINT "FK_1a7f1f42c6fee8f5ecae7ad2edc"`,
        );
        await queryRunner.query(`DROP INDEX "public"."IDX_dfb522820bb828b3ebbfec6a36"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1a7f1f42c6fee8f5ecae7ad2ed"`);
        await queryRunner.query(`DROP TABLE "collection_custom_fields_filter_facets_facet"`);
        await queryRunner.query(
            `ALTER TABLE "collection" DROP COLUMN "customFields__fix_relational_custom_fields__"`,
        );
    }
}
