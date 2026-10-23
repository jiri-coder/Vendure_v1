import type {MessageLoaders} from '@/platform/i18n/messages';

export const ordersMessageLoaders: MessageLoaders = {
    cs: () => import('./messages/cs.json'),
};
