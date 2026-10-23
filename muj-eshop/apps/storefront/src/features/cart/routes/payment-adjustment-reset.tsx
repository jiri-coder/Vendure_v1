'use client';

import {useEffect, useRef} from 'react';
import {useRouter} from '@/platform/i18n/navigation';
import {clearCartPaymentAdjustment} from './actions';

export function PaymentAdjustmentReset() {
    const router = useRouter();
    const started = useRef(false);

    useEffect(() => {
        if (started.current) {
            return;
        }
        started.current = true;
        void clearCartPaymentAdjustment()
            .then(() => router.refresh())
            .catch(error => console.error('Failed to clear checkout payment adjustment', error));
    }, [router]);

    return null;
}
