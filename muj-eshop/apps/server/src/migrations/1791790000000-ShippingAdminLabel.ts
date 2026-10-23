import { MigrationInterface, QueryRunner } from 'typeorm';

const ADMIN_LABELS: Array<[string, string]> = [
    ['courier-0-699', 'Hmotnost 0–6,99 kg'],
    ['courier-7-4999', 'Hmotnost 7–49,99 kg'],
    ['courier-50-49999', 'Hmotnost 50–499,99 kg'],
    ['courier-500-plus', 'Hmotnost od 500 kg'],
    ['courier-pallet-xl', 'Paletová XL, 0–2 000 Kč, 500–50 000 kg'],
    ['courier-pallet-xxl', 'Paletová XXL, 2 001–3 000 Kč, 500–50 000 kg'],
    ['courier-cargo-xl', 'Cargo XL, 3 001–4 000 Kč, 500–50 000 kg'],
    ['courier-cargo-xxl', 'Cargo XXL, od 4 001 Kč, 500–50 000 kg'],
    ['free-shipping-10000', 'Od 10 000 Kč'],
];

export class ShippingAdminLabel1791790000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "shipping_method" ADD "customFieldsAdminlabel" varchar(255)`);
        for (const [code, label] of ADMIN_LABELS) {
            await queryRunner.query(`UPDATE "shipping_method" SET "customFieldsAdminlabel" = ? WHERE "code" = ?`, [
                label,
                code,
            ]);
        }
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "shipping_method" DROP COLUMN "customFieldsAdminlabel"`);
    }
}
