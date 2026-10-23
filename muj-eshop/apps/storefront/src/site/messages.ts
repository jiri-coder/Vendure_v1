import type {MessageLoaders} from '@/platform/i18n/messages';

export const siteMessageLoaders: MessageLoaders = {
    cs: () => import('./messages/cs.json'),
};
