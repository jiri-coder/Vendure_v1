import type {MessageLoaders} from '@/platform/i18n/messages';

export const navigationMessageLoaders: MessageLoaders = {
    cs: () => import('./messages/cs.json'),
};
