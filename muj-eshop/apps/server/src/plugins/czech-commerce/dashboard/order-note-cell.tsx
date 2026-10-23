import { StickyNote } from 'lucide-react';

export function OrderNoteCell({
    getValue,
    row,
}: {
    getValue: () => unknown;
    row: { original: { hasNote?: boolean | null } };
}) {
    const hasNote = Boolean(getValue() ?? row.original.hasNote);
    if (!hasNote) {
        return null;
    }

    return (
        <span
            title="Objednávka obsahuje poznámku"
            className="inline-flex items-center justify-center rounded-md border border-amber-200 bg-amber-50 p-1 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
            <StickyNote className="h-3.5 w-3.5" />
            <span className="sr-only">Objednávka obsahuje poznámku</span>
        </span>
    );
}
