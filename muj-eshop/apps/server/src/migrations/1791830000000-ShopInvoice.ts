import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShopInvoice1791830000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        const sqlite =
            queryRunner.connection.options.type === 'better-sqlite3' ||
            queryRunner.connection.options.type === 'sqlite';

        if (sqlite) {
            await queryRunner.query(`
                CREATE TABLE "shop_invoice" (
                    "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
                    "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
                    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                    "number" varchar NOT NULL,
                    "orderId" integer NOT NULL,
                    "issuedAt" datetime NOT NULL,
                    "currencyCode" varchar NOT NULL,
                    "totalWithTax" integer NOT NULL,
                    "sellerName" varchar(255) NOT NULL,
                    "sellerAddress" text NOT NULL DEFAULT (''),
                    "sellerIco" varchar(64) NOT NULL DEFAULT (''),
                    "sellerDic" varchar(64) NOT NULL DEFAULT (''),
                    "sellerIban" varchar(64) NOT NULL DEFAULT (''),
                    "buyerName" varchar(255) NOT NULL DEFAULT (''),
                    "buyerCompany" varchar(255) NOT NULL DEFAULT (''),
                    "buyerStreet" varchar(255) NOT NULL DEFAULT (''),
                    "buyerCity" varchar(128) NOT NULL DEFAULT (''),
                    "buyerPostalCode" varchar(32) NOT NULL DEFAULT (''),
                    "buyerCountry" varchar(128) NOT NULL DEFAULT (''),
                    "buyerIco" varchar(64) NOT NULL DEFAULT (''),
                    "buyerDic" varchar(64) NOT NULL DEFAULT (''),
                    "buyerEmail" varchar(255) NOT NULL DEFAULT (''),
                    CONSTRAINT "UQ_shop_invoice_number" UNIQUE ("number"),
                    CONSTRAINT "UQ_shop_invoice_orderId" UNIQUE ("orderId"),
                    CONSTRAINT "FK_shop_invoice_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE CASCADE
                )
            `);
            await queryRunner.query(`
                CREATE TABLE "shop_invoice_line" (
                    "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
                    "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
                    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                    "invoiceId" integer NOT NULL,
                    "position" integer NOT NULL,
                    "description" varchar(500) NOT NULL,
                    "quantity" integer NOT NULL,
                    "unitPriceWithTax" integer NOT NULL,
                    "taxRate" double precision NOT NULL,
                    CONSTRAINT "FK_shop_invoice_line_invoice" FOREIGN KEY ("invoiceId") REFERENCES "shop_invoice" ("id") ON DELETE CASCADE
                )
            `);
            return;
        }

        await queryRunner.query(`
            CREATE TABLE "shop_invoice" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" SERIAL PRIMARY KEY,
                "number" character varying NOT NULL,
                "orderId" integer NOT NULL,
                "issuedAt" TIMESTAMP NOT NULL,
                "currencyCode" character varying NOT NULL,
                "totalWithTax" integer NOT NULL,
                "sellerName" character varying(255) NOT NULL,
                "sellerAddress" text NOT NULL DEFAULT '',
                "sellerIco" character varying(64) NOT NULL DEFAULT '',
                "sellerDic" character varying(64) NOT NULL DEFAULT '',
                "sellerIban" character varying(64) NOT NULL DEFAULT '',
                "buyerName" character varying(255) NOT NULL DEFAULT '',
                "buyerCompany" character varying(255) NOT NULL DEFAULT '',
                "buyerStreet" character varying(255) NOT NULL DEFAULT '',
                "buyerCity" character varying(128) NOT NULL DEFAULT '',
                "buyerPostalCode" character varying(32) NOT NULL DEFAULT '',
                "buyerCountry" character varying(128) NOT NULL DEFAULT '',
                "buyerIco" character varying(64) NOT NULL DEFAULT '',
                "buyerDic" character varying(64) NOT NULL DEFAULT '',
                "buyerEmail" character varying(255) NOT NULL DEFAULT '',
                CONSTRAINT "UQ_shop_invoice_number" UNIQUE ("number"),
                CONSTRAINT "UQ_shop_invoice_orderId" UNIQUE ("orderId"),
                CONSTRAINT "FK_shop_invoice_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "shop_invoice_line" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" SERIAL PRIMARY KEY,
                "invoiceId" integer NOT NULL,
                "position" integer NOT NULL,
                "description" character varying(500) NOT NULL,
                "quantity" integer NOT NULL,
                "unitPriceWithTax" integer NOT NULL,
                "taxRate" double precision NOT NULL,
                CONSTRAINT "FK_shop_invoice_line_invoice" FOREIGN KEY ("invoiceId") REFERENCES "shop_invoice" ("id") ON DELETE CASCADE
            )
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "shop_invoice_line"`);
        await queryRunner.query(`DROP TABLE "shop_invoice"`);
    }
}
