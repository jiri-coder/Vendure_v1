type GalleryImage = {
    id: string;
    preview: string;
    source: string;
};

function addImage(images: GalleryImage[], seen: Set<string>, asset: GalleryImage | null | undefined) {
    if (!asset?.id || !asset.preview || seen.has(asset.id)) {
        return;
    }
    seen.add(asset.id);
    images.push({
        id: asset.id,
        preview: asset.preview,
        source: asset.source || asset.preview,
    });
}

export function galleryImagesForVariant(
    productAssets: GalleryImage[],
    variant?: {
        featuredAsset?: GalleryImage | null;
        assets?: GalleryImage[] | null;
    } | null,
): GalleryImage[] {
    const images: GalleryImage[] = [];
    const seen = new Set<string>();
    addImage(images, seen, variant?.featuredAsset ?? undefined);
    for (const asset of variant?.assets ?? []) {
        addImage(images, seen, asset);
    }
    for (const asset of productAssets) {
        addImage(images, seen, asset);
    }
    return images;
}
