import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShippingAllowedPayments1791760000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsPaymentpolicy"`);
        await queryRunner.query(
            `CREATE TABLE "shipping_method_custom_fields_allowed_payment_methods_payment_method" ("shippingMethodId" integer NOT NULL, "paymentMethodId" integer NOT NULL, CONSTRAINT "PK_shipping_allowed_payments" PRIMARY KEY ("shippingMethodId", "paymentMethodId"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_shipping_allowed_payments_shipping" ON "shipping_method_custom_fields_allowed_payment_methods_payment_method" ("shippingMethodId")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_shipping_allowed_payments_payment" ON "shipping_method_custom_fields_allowed_payment_methods_payment_method" ("paymentMethodId")`,
        );
        await queryRunner.query(
            `ALTER TABLE "shipping_method_custom_fields_allowed_payment_methods_payment_method" ADD CONSTRAINT "FK_shipping_allowed_payments_shipping" FOREIGN KEY ("shippingMethodId") REFERENCES "shipping_method"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
        );
        await queryRunner.query(
            `ALTER TABLE "shipping_method_custom_fields_allowed_payment_methods_payment_method" ADD CONSTRAINT "FK_shipping_allowed_payments_payment" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_method"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "shipping_method_custom_fields_allowed_payment_methods_payment_method" DROP CONSTRAINT "FK_shipping_allowed_payments_payment"`,
        );
        await queryRunner.query(
            `ALTER TABLE "shipping_method_custom_fields_allowed_payment_methods_payment_method" DROP CONSTRAINT "FK_shipping_allowed_payments_shipping"`,
        );
        await queryRunner.query(`DROP INDEX "public"."IDX_shipping_allowed_payments_payment"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_shipping_allowed_payments_shipping"`);
        await queryRunner.query(
            `DROP TABLE "shipping_method_custom_fields_allowed_payment_methods_payment_method"`,
        );
        await queryRunner.query(
            `ALTER TABLE "product_variant" ADD "customFieldsPaymentpolicy" character varying(255) DEFAULT 'ANY'`,
        );
    }
}
