import { MigrationInterface, QueryRunner } from 'typeorm';

export class CollectionTranslationFilterFacetFix1791751000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "collection_translation" ADD "customFields__fix_relational_custom_fields__" boolean`,
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "collection_translation" DROP COLUMN "customFields__fix_relational_custom_fields__"`,
        );
    }
}
