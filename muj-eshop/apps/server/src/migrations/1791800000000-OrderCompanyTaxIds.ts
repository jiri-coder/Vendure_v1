import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderCompanyTaxIds1791800000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order" ADD "customFieldsCompanyico" varchar(255)`);
        await queryRunner.query(`ALTER TABLE "order" ADD "customFieldsCompanydic" varchar(255)`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "customFieldsCompanydic"`);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "customFieldsCompanyico"`);
    }
}
