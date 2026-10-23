'use client';

import {createContext, useContext} from 'react';

export interface MerchandisingLabels {
    novinkaId: string | null;
    akceId: string | null;
}

const MerchandisingContext = createContext<MerchandisingLabels>({
    novinkaId: null,
    akceId: null,
});

export function MerchandisingProvider({
    value,
    children,
}: {
    value: MerchandisingLabels;
    children: React.ReactNode;
}) {
    return <MerchandisingContext.Provider value={value}>{children}</MerchandisingContext.Provider>;
}

export function useMerchandisingLabels() {
    return useContext(MerchandisingContext);
}
