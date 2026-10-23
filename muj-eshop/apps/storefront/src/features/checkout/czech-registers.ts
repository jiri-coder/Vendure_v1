export type CheckoutAddressFields = {
    streetLine1: string;
    streetLine2: string;
    city: string;
    province: string;
    postalCode: string;
    countryCode: string;
};

export type AresCompany = CheckoutAddressFields & {
    ico: string;
    dic: string;
    company: string;
};

export type RuianSuggestion = CheckoutAddressFields & {
    id: string;
    label: string;
};

export function normalizeIco(value: string): string | null {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0 || digits.length > 8) {
        return null;
    }
    return digits.padStart(8, '0');
}

export function parseRuianLabel(label: string): CheckoutAddressFields {
    const postalMatch = label.match(/(\d{5})\s+(.+)$/);
    const postalCode = postalMatch?.[1] ?? '';
    const city = postalMatch?.[2]?.trim() ?? '';
    const beforePostal = postalMatch ? label.slice(0, postalMatch.index).replace(/,\s*$/, '') : label;
    const parts = beforePostal.split(',').map(part => part.trim()).filter(Boolean);
    return {
        streetLine1: parts[0] ?? label,
        streetLine2: parts.slice(1).join(', '),
        city,
        province: '',
        postalCode,
        countryCode: 'CZ',
    };
}

type AresSidlo = {
    nazevUlice?: string;
    cisloDomovni?: number;
    cisloOrientacni?: number;
    cisloOrientacniPismeno?: string;
    nazevObce?: string;
    nazevMestskeCastiObvodu?: string;
    nazevKraje?: string;
    psc?: number;
    textovaAdresa?: string;
};

export function mapAresCompany(payload: {
    ico?: string;
    obchodniJmeno?: string;
    dic?: string;
    sidlo?: AresSidlo;
}): AresCompany | null {
    const ico = payload.ico ? normalizeIco(payload.ico) : null;
    if (!ico) {
        return null;
    }
    const sidlo = payload.sidlo ?? {};
    const streetFromParts = formatAresStreet(sidlo);
    const parsedText = sidlo.textovaAdresa ? parseRuianLabel(sidlo.textovaAdresa) : null;
    return {
        ico,
        dic: payload.dic ?? '',
        company: payload.obchodniJmeno ?? '',
        streetLine1: streetFromParts || parsedText?.streetLine1 || '',
        streetLine2: parsedText?.streetLine2 ?? '',
        city: sidlo.nazevMestskeCastiObvodu || sidlo.nazevObce || parsedText?.city || '',
        province: sidlo.nazevKraje || '',
        postalCode: sidlo.psc ? String(sidlo.psc).padStart(5, '0') : parsedText?.postalCode || '',
        countryCode: 'CZ',
    };
}

function formatAresStreet(sidlo: AresSidlo): string {
    const street = sidlo.nazevUlice?.trim() ?? '';
    const house = sidlo.cisloDomovni != null ? String(sidlo.cisloDomovni) : '';
    const orient = sidlo.cisloOrientacni != null ? String(sidlo.cisloOrientacni) : '';
    const letter = sidlo.cisloOrientacniPismeno?.trim() ?? '';
    if (street && house && orient) {
        return `${street} ${house}/${orient}${letter}`;
    }
    if (street && house) {
        return `${street} ${house}`;
    }
    return street;
}
