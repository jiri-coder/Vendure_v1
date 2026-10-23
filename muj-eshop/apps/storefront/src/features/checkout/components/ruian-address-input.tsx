'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import type { RuianSuggestion } from '../czech-registers';

interface RuianAddressInputProps {
    id?: string;
    value: string;
    disabled?: boolean;
    onChange: (value: string) => void;
    onSelect: (suggestion: RuianSuggestion) => void;
}

export function RuianAddressInput({ id, value, disabled, onChange, onSelect }: RuianAddressInputProps) {
    const listId = useId();
    const [suggestions, setSuggestions] = useState<RuianSuggestion[]>([]);
    const [open, setOpen] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const selectedStreetRef = useRef<string | null>(null);

    useEffect(() => {
        const query = value.trim();
        if (query.length < 3 || query === selectedStreetRef.current) {
            setSuggestions([]);
            setOpen(false);
            return;
        }

        const timer = window.setTimeout(async () => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            try {
                const response = await fetch(`/api/czech-registers/ruian?q=${encodeURIComponent(query)}`, {
                    signal: controller.signal,
                });
                if (!response.ok) {
                    return;
                }
                const payload = (await response.json()) as { suggestions?: RuianSuggestion[] };
                if (selectedStreetRef.current === query) {
                    setSuggestions([]);
                    setOpen(false);
                    return;
                }
                setSuggestions(payload.suggestions ?? []);
                setOpen((payload.suggestions ?? []).length > 0);
            } catch {
                if (!controller.signal.aborted) {
                    setSuggestions([]);
                }
            }
        }, 300);

        return () => {
            window.clearTimeout(timer);
            abortRef.current?.abort();
        };
    }, [value]);

    return (
        <div className="relative">
            <Input
                id={id}
                value={value}
                disabled={disabled}
                autoComplete="street-address"
                role="combobox"
                aria-expanded={open && suggestions.length > 0}
                aria-controls={listId}
                onChange={event => {
                    selectedStreetRef.current = null;
                    onChange(event.target.value);
                }}
                onFocus={() => {
                    if (suggestions.length > 0 && selectedStreetRef.current === null) {
                        setOpen(true);
                    }
                }}
                onBlur={() => {
                    window.setTimeout(() => setOpen(false), 150);
                }}
            />
            {open && suggestions.length > 0 && (
                <ul
                    id={listId}
                    role="listbox"
                    className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md"
                >
                    {suggestions.map(suggestion => (
                        <li key={suggestion.id}>
                            <button
                                type="button"
                                role="option"
                                className="w-full rounded-sm px-2 py-1.5 text-left hover:bg-accent"
                                onMouseDown={event => event.preventDefault()}
                                onClick={() => {
                                    selectedStreetRef.current = suggestion.streetLine1.trim();
                                    abortRef.current?.abort();
                                    setOpen(false);
                                    setSuggestions([]);
                                    onSelect(suggestion);
                                }}
                            >
                                {suggestion.label}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
