import { vendureDashboardPlugin } from '@vendure/dashboard/vite';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { defineConfig } from 'vite';

export default defineConfig({
    base: '/dashboard',
    build: {
        outDir: join(__dirname, 'dist/dashboard'),
    },
    plugins: [
        vendureDashboardPlugin({
            // The vendureDashboardPlugin will scan your configuration in order
            // to find any plugins which have dashboard extensions, as well as
            // to introspect the GraphQL schema based on any API extensions
            // and custom fields that are configured.
            vendureConfigPath: pathToFileURL('./src/vendure-config.ts'),
            // Points to the location of your Vendure server.
            // In production, 'auto' lets the dashboard derive the API URL from the
            // server that serves it. In development, we use explicit defaults so that
            // the Vite dev server can reach the Vendure backend.
            api: process.env.NODE_ENV === 'production'
                ? { host: 'auto', port: 'auto' }
                : { host: 'http://localhost', port: 3000 },
            // When you start the Vite server, your Admin API schema will
            // be introspected and the types will be generated in this location.
            // These types can be used in your dashboard extensions to provide
            // type safety when writing queries and mutations.
            gqlOutputPath: './src/gql',
        }),
        {
            name: 'czech-commerce-translations-watch',
            configureServer(server) {
                const poDir = resolve(__dirname, './src/plugins/czech-commerce/dashboard/i18n');
                server.watcher.add(poDir);
                server.watcher.on('change', file => {
                    if (!file.endsWith('.po')) {
                        return;
                    }
                    const mod = server.moduleGraph.getModuleById('\0virtual:plugin-translations');
                    if (mod) {
                        server.moduleGraph.invalidateModule(mod);
                    }
                });
            },
        },
        {
            name: 'czech-commerce-order-totals-alias',
            enforce: 'pre',
            resolveId(source, importer) {
                const id = source.replace(/\\/g, '/');
                const from = (importer ?? '').replace(/\\/g, '/');
                if (
                    source.includes('order-table-totals') &&
                    from.includes('/_orders/components/')
                ) {
                    return resolve(
                        __dirname,
                        './src/plugins/czech-commerce/dashboard/order-table-totals.tsx',
                    );
                }
                if (
                    (id.endsWith('/_authenticated/_orders/orders') ||
                        id.endsWith('/_authenticated/_orders/orders.tsx') ||
                        id.endsWith('/_orders/orders') ||
                        id.endsWith('/_orders/orders.tsx')) &&
                    !id.includes('orders.graphql') &&
                    !id.includes('orders_')
                ) {
                    return resolve(
                        __dirname,
                        './src/plugins/czech-commerce/dashboard/orders-list-page.tsx',
                    );
                }
                if (source === './orders.graphql.js' && from.endsWith('/orders-list-page.tsx')) {
                    return resolve(
                        __dirname,
                        '../../node_modules/@vendure/dashboard/src/app/routes/_authenticated/_orders/orders.graphql.ts',
                    );
                }
            },
        },
    ],
    resolve: {
        alias: {
            // This allows all plugins to reference a shared set of
            // GraphQL types.
            '@/gql': resolve(__dirname, './src/gql/graphql.ts'),
        },
    },
});
