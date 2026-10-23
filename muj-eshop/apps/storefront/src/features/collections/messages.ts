import type {MessageLoaders} from '@/platform/i18n/messages';

export const collectionsMessageLoaders: MessageLoaders = {
    cs: () => import('./messages/cs.json'),
};
