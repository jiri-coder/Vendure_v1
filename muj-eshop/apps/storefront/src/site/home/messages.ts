import type {MessageLoaders} from '@/platform/i18n/messages';

export const homeMessageLoaders: MessageLoaders = {
    cs: () => import('./messages/cs.json'),
};
