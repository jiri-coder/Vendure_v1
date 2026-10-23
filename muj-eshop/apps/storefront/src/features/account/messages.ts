import type {MessageLoaders} from '@/platform/i18n/messages';

export const accountMessageLoaders: MessageLoaders = {
    cs: () => import('./messages/cs.json'),
};
