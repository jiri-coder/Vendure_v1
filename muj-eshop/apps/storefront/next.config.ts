import {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/site/i18n/request.ts');
const isProduction = process.env.NODE_ENV === 'production';
const assetUrl = process.env.NEXT_PUBLIC_ASSET_URL;
const productionAssetPattern = assetUrl
    ? (() => {
        const url = new URL(assetUrl);
        return {
            protocol: url.protocol.replace(':', '') as 'http' | 'https',
            hostname: url.hostname,
            port: url.port,
            pathname: '/**',
        };
    })()
    : undefined;

const nextConfig: NextConfig = {
    cacheComponents: true,
    output: 'standalone',
    images: {
        dangerouslyAllowLocalIP: !isProduction,
        remotePatterns: [
            ...(!isProduction ? [{
                protocol: 'http' as const,
                hostname: 'localhost'
            }] : []),
            ...(productionAssetPattern ? [productionAssetPattern] : []),
        ],
    }
};

export default withNextIntl(nextConfig);
