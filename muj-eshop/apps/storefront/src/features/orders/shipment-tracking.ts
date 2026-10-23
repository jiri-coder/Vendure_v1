const TRACKING_PARAM_KEYS = [
    'match',
    'tracknumbers',
    'tracknum',
    'trackingNumber',
    'tracking_number',
    'shipmentId',
    'parcelNumbers',
    'id',
];

export function isHttpUrl(value: string): boolean {
    return /^https?:\/\//i.test(value.trim());
}

export function customerTrackingNumber(trackingCode: string): string {
    const value = trackingCode.trim();
    if (!value) {
        return '';
    }
    if (!isHttpUrl(value)) {
        return value;
    }
    try {
        const url = new URL(value);
        for (const key of TRACKING_PARAM_KEYS) {
            const param = url.searchParams.get(key)?.trim();
            if (param) {
                return param;
            }
        }
    } catch {
        return value;
    }
    return value;
}

export function customerTrackingUrl(trackingCode: string, method: string): string | null {
    const value = trackingCode.trim();
    if (!value) {
        return null;
    }
    if (isHttpUrl(value)) {
        return value;
    }

    const encoded = encodeURIComponent(value);
    const haystack = method.toLowerCase();
    if (haystack.includes('gls')) {
        return `https://gls-group.com/CZ/cs/sledovani-zasilek?match=${encoded}`;
    }
    if (haystack.includes('fedex')) {
        return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`;
    }
    if (haystack.includes('ppl')) {
        return `https://www.ppl.cz/vyhledat-zasilku?shipmentId=${encoded}`;
    }
    if (haystack.includes('zásilkov') || haystack.includes('zasilkov') || haystack.includes('packeta')) {
        return `https://tracking.packeta.com/cs/?id=${encoded}`;
    }
    if (haystack.includes('dpd')) {
        return `https://tracking.dpd.de/status/cs_CZ/parcel/${encoded}`;
    }
    if (
        haystack.includes('česká pošt') ||
        haystack.includes('ceska post') ||
        haystack.includes('postaonline') ||
        haystack.includes('cpost')
    ) {
        return `https://www.postaonline.cz/trackandtrace/-/zasilka/cislo?parcelNumbers=${encoded}`;
    }
    return null;
}

export function isCustomerVisibleFulfillment(fulfillment: { state: string }): boolean {
    return fulfillment.state !== 'Cancelled';
}
