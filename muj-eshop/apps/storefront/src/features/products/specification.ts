export type SpecificationRow = {
    name: string | null;
    value: string | null;
};

export function mergeSpecificationParameters(
    productRows: SpecificationRow[] | null | undefined,
    variantRows: SpecificationRow[] | null | undefined,
): SpecificationRow[] {
    const rows: SpecificationRow[] = [];
    const indexByName = new Map<string, number>();

    for (const row of productRows ?? []) {
        const key = row.name?.trim().toLocaleLowerCase('cs') ?? '';
        if (key) {
            indexByName.set(key, rows.length);
        }
        rows.push(row);
    }

    for (const row of variantRows ?? []) {
        const key = row.name?.trim().toLocaleLowerCase('cs') ?? '';
        const existingIndex = key ? indexByName.get(key) : undefined;
        if (existingIndex != null) {
            rows[existingIndex] = row;
            continue;
        }
        if (key) {
            indexByName.set(key, rows.length);
        }
        rows.push(row);
    }

    return rows;
}
