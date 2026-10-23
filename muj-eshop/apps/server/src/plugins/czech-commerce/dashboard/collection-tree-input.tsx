import {
    api,
    Button,
    Checkbox,
    DashboardFormComponent,
    Input,
    ScrollArea,
    useFormContext,
    useUserSettings,
} from '@vendure/dashboard';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const COMPONENT_ID = 'czech-commerce.collection-tree';
const HIDDEN_COMPONENT_ID = 'czech-commerce.hidden-field';
const ROOT_COLLECTION_NAME = '__root_collection__';
const PAGE_SIZE = 250;

const COLLECTIONS_QUERY = `
    query CzechCommerceCollectionTree($options: CollectionListOptions) {
        collections(options: $options) {
            items {
                id
                name
                slug
                position
                parentId
                isPrivate
            }
            totalItems
        }
    }
`;

type CollectionRow = {
    id: string;
    name: string;
    slug: string;
    position: number;
    parentId?: string | null;
    isPrivate?: boolean | null;
};

type CollectionNode = CollectionRow & { children: CollectionNode[] };

type CollectionsResponse = {
    collections: {
        items: CollectionRow[];
        totalItems: number;
    };
};

type Labels = {
    search: string;
    loading: string;
    empty: string;
    none: string;
    selected: string;
    private: string;
    columnCategory: string;
    columnPrimary: string;
    primaryOf: string;
};

export const CollectionTreeInput: DashboardFormComponent = ({ value, onChange, disabled, fieldDef, name }) => {
    const { settings } = useUserSettings();
    const form = useFormContext();
    const languageCode = settings.displayLanguage || settings.contentLanguage || 'cs';
    const czech = languageCode.toLowerCase().startsWith('cs');
    const withPrimary = fieldDef?.list === true;
    const selectedIds = useMemo(() => asIdList(value), [value]);
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const primaryName = withPrimary ? primaryFieldName(name) : null;
    const primaryId = asId(primaryName ? form.watch(primaryName) : null);

    const [items, setItems] = useState<CollectionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        loadCollections()
            .then(rows => {
                if (!cancelled) {
                    setItems(rows);
                }
            })
            .catch(cause => {
                if (!cancelled) {
                    setError(cause instanceof Error ? cause.message : String(cause));
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const tree = useMemo(() => buildCollectionTree(items), [items]);
    const byId = useMemo(() => {
        const map = new Map<string, CollectionNode>();
        walk(tree, node => map.set(node.id, node));
        return map;
    }, [tree]);
    const treeOrder = useMemo(() => {
        const ids: string[] = [];
        walk(tree, node => ids.push(node.id));
        return ids;
    }, [tree]);

    const visibleTree = useMemo(() => filterTree(tree, query.trim()), [query, tree]);

    useEffect(() => {
        const next = new Set<string>();
        const focusIds = primaryId ? [...selectedSet, primaryId] : [...selectedSet];
        for (const id of focusIds) {
            for (const ancestorId of ancestorIds(byId, id)) {
                next.add(ancestorId);
            }
        }
        if (query.trim()) {
            walk(visibleTree, node => {
                if (node.children.length > 0) {
                    next.add(node.id);
                }
            });
        }
        if (next.size === 0) {
            return;
        }
        setExpanded(current => {
            const merged = new Set(current);
            let changed = false;
            for (const id of next) {
                if (!merged.has(id)) {
                    merged.add(id);
                    changed = true;
                }
            }
            return changed ? merged : current;
        });
    }, [byId, primaryId, query, selectedSet, visibleTree]);

    const labels: Labels = czech
        ? {
              search: 'Hledat kategorii…',
              loading: 'Načítám kategorie…',
              empty: 'Žádné kategorie',
              none: 'Žádné výsledky',
              selected: 'Vybrané',
              private: 'skrytá',
              columnCategory: 'Kategorie',
              columnPrimary: 'Hlavní',
              primaryOf: 'Hlavní kategorie',
          }
        : {
              search: 'Search category…',
              loading: 'Loading categories…',
              empty: 'No categories',
              none: 'No results',
              selected: 'Selected',
              private: 'private',
              columnCategory: 'Category',
              columnPrimary: 'Primary',
              primaryOf: 'Primary category',
          };

    const setPrimary = (id: string | null) => {
        if (!primaryName || disabled) {
            return;
        }
        form.setValue(primaryName, id, { shouldDirty: true, shouldTouch: true });
    };

    const toggleExpanded = (id: string) => {
        setExpanded(current => {
            const next = new Set(current);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const selectNode = (id: string, checked: boolean) => {
        if (disabled) {
            return;
        }
        const next = checked
            ? [...new Set([...selectedIds, id])]
            : selectedIds.filter(item => item !== id);
        onChange(next);
        if (!withPrimary) {
            return;
        }
        if (checked && !primaryId) {
            setPrimary(id);
        }
        if (!checked && primaryId === id) {
            setPrimary(next[0] ?? null);
        }
    };

    const selectPrimary = (id: string) => {
        if (disabled) {
            return;
        }
        setPrimary(id);
        if (!selectedSet.has(id)) {
            onChange([...new Set([...selectedIds, id])]);
        }
    };

    const selectedNodes = [...selectedSet]
        .map(id => byId.get(id))
        .filter((node): node is CollectionNode => Boolean(node))
        .sort((left, right) => {
            if (left.id === primaryId) {
                return -1;
            }
            if (right.id === primaryId) {
                return 1;
            }
            return treeOrder.indexOf(left.id) - treeOrder.indexOf(right.id);
        });

    return (
        <div className="flex flex-col gap-2">
            {selectedNodes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    <span className="text-muted-foreground self-center text-xs">{labels.selected}:</span>
                    {selectedNodes.map(node => (
                        <Button
                            key={node.id}
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 px-2"
                            disabled={disabled}
                            onClick={() => selectNode(node.id, false)}
                        >
                            {node.name}
                            {node.id === primaryId ? (
                                <span className="text-muted-foreground ml-1 text-[10px] uppercase">
                                    {labels.columnPrimary}
                                </span>
                            ) : null}
                            <span className="ml-1 opacity-60">×</span>
                        </Button>
                    ))}
                </div>
            )}
            <Input
                value={query}
                disabled={disabled || loading}
                placeholder={labels.search}
                onChange={event => setQuery(event.target.value)}
            />
            <ScrollArea className="h-80 rounded-md border">
                <div className="p-2">
                    {withPrimary && !loading && !error && visibleTree.length > 0 && (
                        <div className="text-muted-foreground mb-1 flex items-center px-1 text-xs font-medium">
                            <span className="min-w-0 flex-1">{labels.columnCategory}</span>
                            <span className="w-16 shrink-0 text-center">{labels.columnPrimary}</span>
                        </div>
                    )}
                    {loading && <p className="text-muted-foreground px-2 py-4 text-sm">{labels.loading}</p>}
                    {error && <p className="text-destructive px-2 py-4 text-sm">{error}</p>}
                    {!loading && !error && visibleTree.length === 0 && (
                        <p className="text-muted-foreground px-2 py-4 text-sm">
                            {tree.length === 0 ? labels.empty : labels.none}
                        </p>
                    )}
                    {!loading &&
                        !error &&
                        visibleTree.map(node => (
                            <TreeRow
                                key={node.id}
                                node={node}
                                depth={0}
                                disabled={disabled}
                                expanded={expanded}
                                labels={labels}
                                primaryId={withPrimary ? primaryId : null}
                                selectedSet={selectedSet}
                                showPrimary={withPrimary}
                                onToggle={toggleExpanded}
                                onSelect={selectNode}
                                onPrimary={selectPrimary}
                            />
                        ))}
                </div>
            </ScrollArea>
        </div>
    );
};

CollectionTreeInput.metadata = {
    isListInput: 'dynamic',
    isFullWidth: true,
};

export const HiddenFormInput: DashboardFormComponent = () => {
    const ref = useRef<HTMLSpanElement>(null);
    useLayoutEffect(() => {
        const field = ref.current?.parentElement;
        const cell = field?.parentElement;
        if (cell instanceof HTMLElement) {
            cell.style.display = 'none';
        }
    }, []);
    return <span ref={ref} hidden />;
};

HiddenFormInput.metadata = {
    isListInput: 'dynamic',
};

export const collectionTreeComponentId = COMPONENT_ID;
export const hiddenFieldComponentId = HIDDEN_COMPONENT_ID;

function TreeRow({
    node,
    depth,
    disabled,
    expanded,
    labels,
    primaryId,
    selectedSet,
    showPrimary,
    onToggle,
    onSelect,
    onPrimary,
}: {
    node: CollectionNode;
    depth: number;
    disabled?: boolean;
    expanded: Set<string>;
    labels: Labels;
    primaryId: string | null;
    selectedSet: Set<string>;
    showPrimary: boolean;
    onToggle: (id: string) => void;
    onSelect: (id: string, checked: boolean) => void;
    onPrimary: (id: string) => void;
}) {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const checked = selectedSet.has(node.id);

    return (
        <div>
            <div className="hover:bg-accent/50 flex items-center rounded-md py-1">
                <div
                    className="flex min-w-0 flex-1 items-center gap-1"
                    style={{ paddingLeft: `${depth * 16 + 4}px` }}
                >
                    {hasChildren ? (
                        <button
                            type="button"
                            className="text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center"
                            aria-expanded={isExpanded}
                            onClick={() => onToggle(node.id)}
                        >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                    ) : (
                        <span className="w-6 shrink-0" />
                    )}
                    <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={value => onSelect(node.id, value === true)}
                        aria-label={node.name}
                    />
                    <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-sm"
                        disabled={disabled}
                        onClick={() => onSelect(node.id, !checked)}
                    >
                        {node.name}
                        {node.isPrivate ? (
                            <span className="text-muted-foreground ml-2 text-xs">{labels.private}</span>
                        ) : null}
                    </button>
                </div>
                {showPrimary && (
                    <div className="flex w-16 shrink-0 items-center justify-center">
                        <input
                            type="radio"
                            name="product-primary-category"
                            className="accent-primary h-4 w-4"
                            checked={primaryId === node.id}
                            disabled={disabled}
                            aria-label={`${labels.primaryOf}: ${node.name}`}
                            onChange={() => onPrimary(node.id)}
                        />
                    </div>
                )}
            </div>
            {hasChildren && isExpanded
                ? node.children.map(child => (
                      <TreeRow
                          key={child.id}
                          node={child}
                          depth={depth + 1}
                          disabled={disabled}
                          expanded={expanded}
                          labels={labels}
                          primaryId={primaryId}
                          selectedSet={selectedSet}
                          showPrimary={showPrimary}
                          onToggle={onToggle}
                          onSelect={onSelect}
                          onPrimary={onPrimary}
                      />
                  ))
                : null}
        </div>
    );
}

async function loadCollections(): Promise<CollectionRow[]> {
    const items: CollectionRow[] = [];
    let skip = 0;
    let total = Number.POSITIVE_INFINITY;
    while (items.length < total) {
        const response = (await api.query(COLLECTIONS_QUERY, {
            options: {
                skip,
                take: PAGE_SIZE,
                sort: { position: 'ASC' },
            },
        })) as CollectionsResponse;
        items.push(...(response.collections.items ?? []));
        total = response.collections.totalItems ?? items.length;
        skip += PAGE_SIZE;
        if ((response.collections.items ?? []).length === 0) {
            break;
        }
    }
    return items;
}

export function buildCollectionTree(items: CollectionRow[]): CollectionNode[] {
    const byParent = new Map<string, CollectionRow[]>();
    const ids = new Set(items.map(item => item.id));
    for (const item of items) {
        const parentId = item.parentId && ids.has(item.parentId) ? item.parentId : '';
        const siblings = byParent.get(parentId) ?? [];
        siblings.push(item);
        byParent.set(parentId, siblings);
    }
    for (const siblings of byParent.values()) {
        siblings.sort((left, right) => left.position - right.position || left.name.localeCompare(right.name, 'cs'));
    }

    const catalogRoot = items.find(item => item.name === ROOT_COLLECTION_NAME);
    const topLevel = catalogRoot
        ? (byParent.get(catalogRoot.id) ?? [])
        : (byParent.get('') ?? []).filter(item => item.name !== ROOT_COLLECTION_NAME);

    const nest = (rows: CollectionRow[]): CollectionNode[] =>
        rows.map(row => ({
            ...row,
            children: nest(byParent.get(row.id) ?? []),
        }));

    return nest(topLevel);
}

function filterTree(nodes: CollectionNode[], term: string): CollectionNode[] {
    if (!term) {
        return nodes;
    }
    const needle = term.toLocaleLowerCase('cs');
    const match = (node: CollectionNode): CollectionNode | null => {
        const childMatches = node.children.map(match).filter((child): child is CollectionNode => child != null);
        if (node.name.toLocaleLowerCase('cs').includes(needle)) {
            return node;
        }
        if (childMatches.length > 0) {
            return { ...node, children: childMatches };
        }
        return null;
    };
    return nodes.map(match).filter((node): node is CollectionNode => node != null);
}

function walk(nodes: CollectionNode[], visit: (node: CollectionNode) => void) {
    for (const node of nodes) {
        visit(node);
        walk(node.children, visit);
    }
}

function ancestorIds(byId: Map<string, CollectionNode>, id: string): string[] {
    const ids: string[] = [];
    const parentByChild = new Map<string, string>();
    for (const node of byId.values()) {
        for (const child of node.children) {
            parentByChild.set(child.id, node.id);
        }
    }
    let current = parentByChild.get(id);
    while (current) {
        ids.push(current);
        current = parentByChild.get(current);
    }
    return ids;
}

function primaryFieldName(name: string | undefined): string {
    if (!name) {
        return 'customFields.primaryCategoryId';
    }
    if (name.endsWith('categoriesIds')) {
        return `${name.slice(0, -'categoriesIds'.length)}primaryCategoryId`;
    }
    return 'customFields.primaryCategoryId';
}

function asId(value: unknown): string | null {
    if (value == null || value === '') {
        return null;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
    }
    if (typeof value === 'object' && 'id' in value && (value as { id?: unknown }).id != null) {
        return String((value as { id: unknown }).id);
    }
    return null;
}

function asIdList(value: unknown): string[] {
    if (!Array.isArray(value)) {
        const id = asId(value);
        return id ? [id] : [];
    }
    return value.flatMap(item => {
        const id = asId(item);
        return id ? [id] : [];
    });
}
