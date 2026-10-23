import { NextRequest, NextResponse } from 'next/server';
import { mapAresCompany, normalizeIco } from '@/features/checkout/czech-registers';

const ARES_URL = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty';
const USER_AGENT = 'koupelny-eshop/1.0 (checkout; https://koupelny-eshop.com)';

export async function GET(request: NextRequest) {
    const ico = normalizeIco(request.nextUrl.searchParams.get('ico') ?? '');
    if (!ico) {
        return NextResponse.json({ error: 'invalid_ico' }, { status: 400 });
    }

    try {
        const response = await fetch(`${ARES_URL}/${ico}`, {
            headers: {
                Accept: 'application/json',
                'User-Agent': USER_AGENT,
            },
            next: { revalidate: 0 },
        });

        if (response.status === 404) {
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }
        if (!response.ok) {
            return NextResponse.json({ error: 'unavailable' }, { status: 502 });
        }

        const payload = (await response.json()) as Parameters<typeof mapAresCompany>[0];
        const company = mapAresCompany(payload);
        if (!company) {
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }
        return NextResponse.json({ company });
    } catch {
        return NextResponse.json({ error: 'unavailable' }, { status: 502 });
    }
}
