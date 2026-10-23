import { NextRequest, NextResponse } from 'next/server';
import { parseRuianLabel, type RuianSuggestion } from '@/features/checkout/czech-registers';

const RUIAN_SUGGEST_URL =
    'https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/suggest';
const USER_AGENT = 'koupelny-eshop/1.0 (checkout; https://koupelny-eshop.com)';

type RuianSuggestResponse = {
    suggestions?: Array<{
        text?: string;
        magicKey?: string;
        type?: string;
    }>;
};

export async function GET(request: NextRequest) {
    const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    if (query.length < 3) {
        return NextResponse.json({ suggestions: [] as RuianSuggestion[] });
    }

    try {
        const url = new URL(RUIAN_SUGGEST_URL);
        url.searchParams.set('text', query);
        url.searchParams.set('f', 'json');
        url.searchParams.set('maxSuggestions', '8');

        const response = await fetch(url, {
            headers: {
                Accept: 'application/json',
                'User-Agent': USER_AGENT,
            },
            next: { revalidate: 0 },
        });
        if (!response.ok) {
            return NextResponse.json({ error: 'unavailable' }, { status: 502 });
        }

        const payload = (await response.json()) as RuianSuggestResponse;
        const suggestions = (payload.suggestions ?? [])
            .filter(item => item.type === 'AdresniMisto' && item.text)
            .map(item => {
                const parsed = parseRuianLabel(item.text as string);
                return {
                    id: item.magicKey || item.text || '',
                    label: item.text as string,
                    ...parsed,
                } satisfies RuianSuggestion;
            });

        return NextResponse.json({ suggestions });
    } catch {
        return NextResponse.json({ error: 'unavailable' }, { status: 502 });
    }
}
