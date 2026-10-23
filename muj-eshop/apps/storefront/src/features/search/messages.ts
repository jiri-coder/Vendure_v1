import type {MessageLoaders} from '@/platform/i18n/messages';

export const searchMessageLoaders: MessageLoaders = {
    cs: () => import('./messages/cs.json'),
};
