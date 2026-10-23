'use client';

import {ChevronDown} from 'lucide-react';
import {Link} from '@/platform/i18n/navigation';
import type {CatalogCollection} from '@/features/collections/data';

function ChildColumn({collection}: {collection: CatalogCollection}) {
    return (
        <div className="min-w-0">
            <Link
                href={`/collection/${collection.slug}`}
                className="block text-sm font-semibold hover:text-primary"
            >
                {collection.name}
            </Link>
            {collection.children.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                    {collection.children.map(child => (
                        <li key={child.id}>
                            <Link
                                href={`/collection/${child.slug}`}
                                className="block text-sm text-muted-foreground hover:text-foreground"
                            >
                                {child.name}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function CatalogMenu({collections}: {collections: CatalogCollection[]}) {
    if (collections.length === 0) {
        return null;
    }

    return (
        <nav aria-label="Katalog" className="relative hidden border-t bg-background md:block">
            <ul className="container mx-auto flex flex-wrap items-center gap-x-1 px-2">
                {collections.map(collection => (
                    <li key={collection.id} className="group static">
                        <Link
                            href={`/collection/${collection.slug}`}
                            className="inline-flex items-center gap-1 px-2.5 py-2.5 text-sm font-medium hover:text-primary"
                        >
                            {collection.name}
                            {collection.children.length > 0 && (
                                <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-hover:rotate-180" />
                            )}
                        </Link>
                        {collection.children.length > 0 && (
                            <div className="absolute inset-x-0 top-full z-50 hidden group-hover:block group-focus-within:block">
                                <div className="border-b bg-popover shadow-lg">
                                    <div className="container mx-auto grid grid-cols-2 gap-x-8 gap-y-6 px-6 py-6 md:grid-cols-3 xl:grid-cols-4 max-h-[70vh] overflow-y-auto">
                                        {collection.children.map(child => (
                                            <ChildColumn key={child.id} collection={child} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </nav>
    );
}
