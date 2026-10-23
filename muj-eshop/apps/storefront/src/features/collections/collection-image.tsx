import Image from 'next/image';
import {ImageIcon} from 'lucide-react';

export function CollectionImage({
    src,
    alt,
    sizes,
}: {
    src?: string | null;
    alt: string;
    sizes: string;
}) {
    return (
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
            {src ? (
                <Image
                    src={src}
                    alt={alt}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes={sizes}
                />
            ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground" aria-hidden>
                    <ImageIcon className="size-8" aria-hidden />
                </div>
            )}
        </div>
    );
}
