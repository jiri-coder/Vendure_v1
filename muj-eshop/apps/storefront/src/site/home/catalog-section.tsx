import {Link} from '@/platform/i18n/navigation';
import {getRouteLocale} from '@/platform/i18n/server';
import {CollectionImage} from '@/features/collections/collection-image';
import {getTopCollections} from '@/features/collections/data';

export async function CatalogSection() {
    const locale = await getRouteLocale();
    const collections = await getTopCollections(locale);

    if (collections.length === 0) {
        return null;
    }

    return (
        <section id="katalog" className="container mx-auto scroll-mt-36 px-4 py-16">
            <h2 className="mb-8 text-2xl font-bold tracking-tight md:text-3xl">Katalog</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {collections.map(collection => (
                    <Link
                        key={collection.id}
                        href={`/collection/${collection.slug}`}
                        className="group overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary"
                    >
                        <CollectionImage
                            src={collection.featuredAsset?.preview}
                            alt=""
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                        />
                        <div className="p-5">
                            <h3 className="font-semibold">{collection.name}</h3>
                            {collection.children.length > 0 && (
                                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                                    {collection.children.map(child => child.name).join(' · ')}
                                </p>
                            )}
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
