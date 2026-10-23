import {
    DefaultJobQueuePlugin,
    DefaultSchedulerPlugin,
    DefaultSearchPlugin,
    defaultOrderProcess,
    VendureConfig,
} from '@vendure/core';
import { processingOrderProcess } from './order-process';
import { EmailPlugin, FileBasedTemplateLoader } from '@vendure/email-plugin';
import { shopEmailHandlers } from './email/shop-email-handlers';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { GraphiqlPlugin } from '@vendure/graphiql-plugin';
import 'dotenv/config';
import path from 'path';
import { CzechCommercePlugin } from './plugins/czech-commerce/czech-commerce.plugin';
import {
    bankTransferPaymentHandler,
    cashOnDeliveryPaymentHandler,
    payAtPickupPaymentHandler,
} from './plugins/czech-commerce/manual-payment-handlers';

const IS_DEV = process.env.APP_ENV !== 'production';
// PORT wins because hosting platforms inject it into the environment at runtime, and that
// must take precedence over any value baked into the .env file at scaffold time.
const serverPort = +process.env.PORT || +process.env.VENDURE_SERVER_PORT || 3000;
const storefrontUrl = (process.env.STOREFRONT_URL || 'http://localhost:3001').replace(/\/$/, '');
const shopName = process.env.SITE_NAME || 'koupelny-eshop';
const emailFromAddress = process.env.EMAIL_FROM_ADDRESS || `"${shopName}" <noreply@localhost>`;
const emailTemplateVars = {
    fromAddress: emailFromAddress,
    shopName,
    shopUrl: `${storefrontUrl}/cs`,
    verifyEmailAddressUrl: `${storefrontUrl}/cs/verify`,
    passwordResetUrl: `${storefrontUrl}/cs/reset-password`,
    changeEmailAddressUrl: `${storefrontUrl}/cs/account/verify-email`,
};

export const config: VendureConfig = {
    apiOptions: {
        port: serverPort,
        adminApiPath: 'admin-api',
        shopApiPath: 'shop-api',
        trustProxy: IS_DEV ? false : 1,
        // Which browser origins may make credentialed requests to the Shop and Admin APIs.
        // In dev any origin is reflected, so a storefront on any port works. In production set
        // CORS_ORIGINS to a comma-separated list of the origins you serve, for example
        // "https://example.com,https://admin.example.com". An unset value blocks all
        // cross-origin browser requests, which is the safe default.
        cors: {
            origin: IS_DEV ? true : (process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) ?? []),
            credentials: true,
        },
        csrfPrevention: !IS_DEV,
        // The following options are useful in development mode,
        // but are best turned off for production for security
        // reasons.
        ...(IS_DEV ? {
            adminApiDebug: true,
            shopApiDebug: true,
        } : {}),
    },
    authOptions: {
        tokenMethod: ['bearer', 'cookie'],
        superadminCredentials: {
            identifier: process.env.SUPERADMIN_USERNAME,
            password: process.env.SUPERADMIN_PASSWORD,
        },
        cookieOptions: {
          secret: process.env.COOKIE_SECRET,
        },
        requireVerification: true,
    },
    dbConnectionOptions: IS_DEV
        ? {
            type: 'better-sqlite3',
            synchronize: false,
            migrations: [path.join(__dirname, './migrations/*.+(js|ts)')],
            logging: false,
            database: path.join(__dirname, '../vendure.sqlite'),
        }
        : {
            type: 'postgres',
            synchronize: false,
            migrations: [path.join(__dirname, './migrations/postgres/*.+(js|ts)')],
            logging: false,
            host: process.env.DB_HOST,
            port: +(process.env.DB_PORT || 5432),
            database: process.env.DB_NAME,
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            ssl: process.env.DB_SSL === 'true'
                ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
                : false,
        },
    orderOptions: {
        process: [defaultOrderProcess, processingOrderProcess],
    },
    paymentOptions: {
        paymentMethodHandlers: [
            bankTransferPaymentHandler,
            cashOnDeliveryPaymentHandler,
            payAtPickupPaymentHandler,
        ],
    },
    // When adding or altering custom field definitions, the database will
    // need to be updated. See the "Migrations" section in README.md.
    customFields: {},
    plugins: [
        ...(IS_DEV ? [GraphiqlPlugin.init()] : []),
        AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: process.env.ASSET_UPLOAD_DIR ||
                path.join(__dirname, '../static/assets'),
            assetUrlPrefix: IS_DEV ? undefined : process.env.ASSET_URL_PREFIX,
        }),
        DefaultSchedulerPlugin.init(),
        DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),
        DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: true }),
        CzechCommercePlugin,
        EmailPlugin.init(IS_DEV ? {
            devMode: true,
            outputPath: path.join(__dirname, '../static/email/test-emails'),
            route: 'mailbox',
            handlers: shopEmailHandlers,
            templateLoader: new FileBasedTemplateLoader(path.join(__dirname, '../static/email/templates')),
            globalTemplateVars: emailTemplateVars,
        } : {
            transport: {
                type: 'smtp',
                host: process.env.SMTP_HOST,
                port: +(process.env.SMTP_PORT || 587),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USERNAME,
                    pass: process.env.SMTP_PASSWORD,
                },
            },
            handlers: shopEmailHandlers,
            templateLoader: new FileBasedTemplateLoader(path.join(__dirname, '../static/email/templates')),
            globalTemplateVars: emailTemplateVars,
        }),
        DashboardPlugin.init({
            route: 'dashboard',
            appDir: IS_DEV
                ? path.join(__dirname, '../dist/dashboard')
                : path.join(__dirname, 'dashboard'),
        }),
    ],
};
