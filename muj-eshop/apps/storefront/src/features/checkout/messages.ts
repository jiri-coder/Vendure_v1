import type {MessageLoaders} from '@/platform/i18n/messages';

export const checkoutMessageLoaders: MessageLoaders = {
    cs: () => import('./messages/cs.json'),
};
