import type {MessageLoaders} from '@/platform/i18n/messages';

export const productsMessageLoaders: MessageLoaders = {
    cs: () => import('./messages/cs.json'),
};
