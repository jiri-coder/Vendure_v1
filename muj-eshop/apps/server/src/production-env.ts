const REQUIRED_PRODUCTION_ENV = [
    'COOKIE_SECRET',
    'SUPERADMIN_USERNAME',
    'SUPERADMIN_PASSWORD',
    'CORS_ORIGINS',
    'DB_HOST',
    'DB_NAME',
    'DB_USERNAME',
    'DB_PASSWORD',
    'ASSET_URL_PREFIX',
    'STOREFRONT_URL',
    'EMAIL_FROM_ADDRESS',
    'EMAIL_ORDER_NOTIFY_ADDRESS',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USERNAME',
    'SMTP_PASSWORD',
] as const;

export function assertProductionEnvironment(): void {
    if (process.env.APP_ENV !== 'production') {
        return;
    }

    const missing = REQUIRED_PRODUCTION_ENV.filter(name => !process.env[name]?.trim());
    if (missing.length > 0) {
        throw new Error(
            `Missing required production environment variables: ${missing.join(', ')}`,
        );
    }

    if ((process.env.COOKIE_SECRET?.length ?? 0) < 32) {
        throw new Error('COOKIE_SECRET must contain at least 32 characters in production');
    }

    if (process.env.SUPERADMIN_PASSWORD === 'superadmin') {
        throw new Error('The default SUPERADMIN_PASSWORD must not be used in production');
    }
}
