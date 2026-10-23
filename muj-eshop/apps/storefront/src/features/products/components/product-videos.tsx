interface ProductVideosProps {
    urls: Array<string | null> | null | undefined;
    title: string;
}

type VideoEmbed =
    | {kind: 'iframe'; src: string}
    | {kind: 'file'; src: string};

export function ProductVideos({urls, title}: ProductVideosProps) {
    const videos = (urls ?? []).flatMap(url => {
        const embed = videoEmbed(url);
        return embed ? [embed] : [];
    });
    if (videos.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3">
            <h2 className="text-sm font-semibold">{title}</h2>
            <div className="space-y-3">
                {videos.map(video => (
                    <div key={video.src} className="overflow-hidden rounded-xl bg-muted">
                        {video.kind === 'iframe' ? (
                            <iframe
                                src={video.src}
                                title={title}
                                className="aspect-video w-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        ) : (
                            <video src={video.src} className="aspect-video w-full" controls playsInline />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function videoEmbed(raw: string | null | undefined): VideoEmbed | null {
    const url = raw?.trim() ?? '';
    if (!url) {
        return null;
    }
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return null;
    }

    const youtube = parsed.hostname.replace(/^www\./, '').match(/^(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/);
    if (youtube) {
        const id = youtubeId(parsed);
        return id ? {kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}`} : null;
    }
    if (parsed.hostname.replace(/^www\./, '') === 'vimeo.com' || parsed.hostname === 'player.vimeo.com') {
        const id = parsed.pathname.match(/\/(?:video\/)?(\d+)/)?.[1];
        return id ? {kind: 'iframe', src: `https://player.vimeo.com/video/${id}`} : null;
    }
    if (/\.(mp4|webm|ogg)(?:$|\?)/i.test(parsed.pathname)) {
        return {kind: 'file', src: parsed.toString()};
    }
    return null;
}

function youtubeId(url: URL): string | null {
    if (url.hostname.replace(/^www\./, '') === 'youtu.be') {
        return url.pathname.match(/^\/([\w-]{11})/)?.[1] ?? null;
    }
    const fromQuery = url.searchParams.get('v');
    if (fromQuery && /^[\w-]{11}$/.test(fromQuery)) {
        return fromQuery;
    }
    return url.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/)?.[1] ?? null;
}
