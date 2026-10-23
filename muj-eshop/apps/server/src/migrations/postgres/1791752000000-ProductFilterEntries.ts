import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductFilterEntries1791752000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsFilterentries" text`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsFilterentries"`);
    }
}
