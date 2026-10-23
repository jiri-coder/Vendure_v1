export type Messages = Record<string, unknown>;
export type MessageLoader = () => Promise<{default: Messages}>;
export type MessageLoaders = Record<string, MessageLoader>;

export const platformMessageLoaders: MessageLoaders = {
    cs: () => import('./messages/cs.json'),
};
