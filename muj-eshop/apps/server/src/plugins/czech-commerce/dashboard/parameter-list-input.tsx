import { Button, DashboardFormComponent, Input, useUserSettings } from '@vendure/dashboard';
import { useRef } from 'react';

type ParameterRow = {
    name: string;
    value: string;
};

const COMPONENT_ID = 'czech-commerce.parameter-list';

export const ParameterListInput: DashboardFormComponent = ({ value, onChange, disabled, fieldDef }) => {
    const { settings } = useUserSettings();
    const languageCode = settings.displayLanguage || settings.contentLanguage || 'cs';
    const czech = languageCode.toLowerCase().startsWith('cs');
    const nameLabel = structFieldLabel(fieldDef, 'name', languageCode, czech ? 'Název' : 'Name');
    const valueLabel = structFieldLabel(fieldDef, 'value', languageCode, czech ? 'Hodnota' : 'Value');
    const removeLabel = czech ? 'Odebrat' : 'Remove';
    const addLabel = czech ? 'Přidat parametr' : 'Add parameter';
    const rows = normalizeRows(value);
    const rowIds = useRef<string[]>([]);
    const ids = alignRowIds(rowIds.current, rows.length);
    rowIds.current = ids;

    const updateRow = (index: number, key: keyof ParameterRow, nextValue: string) => {
        const next = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: nextValue } : row));
        onChange(next);
    };

    const addRow = () => {
        rowIds.current = [...rowIds.current, createRowId()];
        onChange([...rows, { name: '', value: '' }]);
    };

    const removeRow = (index: number) => {
        rowIds.current = rowIds.current.filter((_, rowIndex) => rowIndex !== index);
        onChange(rows.filter((_, rowIndex) => rowIndex !== index));
    };

    return (
        <div className="flex flex-col gap-2">
            {rows.length > 0 && (
                <div className="text-muted-foreground grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 text-sm">
                    <span>{nameLabel}</span>
                    <span>{valueLabel}</span>
                    <span className="w-24" />
                </div>
            )}
            {rows.map((row, index) => (
                <div key={ids[index]} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
                    <Input
                        value={row.name}
                        disabled={disabled}
                        aria-label={`${nameLabel} ${index + 1}`}
                        onChange={event => updateRow(index, 'name', event.target.value)}
                    />
                    <Input
                        value={row.value}
                        disabled={disabled}
                        aria-label={`${valueLabel} ${index + 1}`}
                        onChange={event => updateRow(index, 'value', event.target.value)}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        className="w-24"
                        disabled={disabled}
                        onClick={() => removeRow(index)}
                    >
                        {removeLabel}
                    </Button>
                </div>
            ))}
            <div>
                <Button type="button" variant="secondary" disabled={disabled} onClick={addRow}>
                    {addLabel}
                </Button>
            </div>
        </div>
    );
};

ParameterListInput.metadata = {
    isListInput: true,
    isFullWidth: true,
};

export const parameterListComponentId = COMPONENT_ID;

function normalizeRows(value: unknown): ParameterRow[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map(item => {
        if (!item || typeof item !== 'object') {
            return { name: '', value: '' };
        }
        const row = item as Record<string, unknown>;
        return {
            name: typeof row.name === 'string' ? row.name : '',
            value: typeof row.value === 'string' ? row.value : '',
        };
    });
}

function alignRowIds(current: string[], length: number): string[] {
    if (current.length === length) {
        return current;
    }
    if (current.length < length) {
        return [...current, ...Array.from({ length: length - current.length }, createRowId)];
    }
    return current.slice(0, length);
}

function createRowId() {
    return globalThis.crypto?.randomUUID?.() ?? `parameter-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function structFieldLabel(fieldDef: unknown, name: string, languageCode: string, fallback: string) {
    const fields =
        fieldDef && typeof fieldDef === 'object' && 'fields' in fieldDef && Array.isArray(fieldDef.fields)
            ? (fieldDef.fields as Array<{ name: string; label?: Array<{ languageCode: string; value: string }> }>)
            : [];
    const field = fields.find(item => item.name === name);
    const labels = field?.label ?? [];
    return (
        labels.find(item => item.languageCode === languageCode)?.value ??
        labels.find(item => item.languageCode === 'cs')?.value ??
        labels[0]?.value ??
        fallback
    );
}
