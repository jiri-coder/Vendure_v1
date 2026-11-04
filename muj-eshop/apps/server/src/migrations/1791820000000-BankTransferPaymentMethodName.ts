import { MigrationInterface, QueryRunner } from 'typeorm';

export class BankTransferPaymentMethodName1791820000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE "payment_method_translation" SET "name" = ? WHERE "name" = ? AND "languageCode" = ?`,
            ['Platba převodem', 'Platba předem na účet', 'cs'],
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE "payment_method_translation" SET "name" = ? WHERE "name" = ? AND "languageCode" = ?`,
            ['Platba předem na účet', 'Platba převodem', 'cs'],
        );
    }
}
