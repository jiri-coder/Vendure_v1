import {FileDown} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import {getRouteLocale} from '@/platform/i18n/server';

interface ProductDetailsProps {
    description: string;
    parameters: Array<{name: string | null; value: string | null}> | null;
    downloads: Array<{
        id: string;
        name: string;
        source: string;
        mimeType: string;
    }> | null;
}

function visibleText(html: string): string {
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export async function ProductDetails({description, parameters, downloads}: ProductDetailsProps) {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Product'});
    const parameterRows = (parameters ?? []).flatMap(row => {
        const name = row.name?.trim() ?? '';
        const value = row.value?.trim() ?? '';
        return name || value ? [{name, value}] : [];
    });
    const files = (downloads ?? []).filter(file => file.source);
    const hasDescription = visibleText(description).length > 0;

    if (!hasDescription && parameterRows.length === 0 && files.length === 0) {
        return null;
    }

    return (
        <section className="container mx-auto px-4 pb-4">
            <div className="mx-auto max-w-4xl space-y-12">
                {hasDescription && (
                    <div>
                        <h2 className="text-2xl font-bold mb-4">{t('longDescription')}</h2>
                        <div
                            className="prose prose-sm max-w-none text-muted-foreground"
                            dangerouslySetInnerHTML={{__html: description}}
                        />
                    </div>
                )}
                {parameterRows.length > 0 && (
                    <div>
                        <h2 className="text-2xl font-bold mb-4">{t('parameters')}</h2>
                        <div className="overflow-hidden rounded-xl border">
                            <table className="w-full text-sm">
                                <tbody>
                                    {parameterRows.map((row, index) => (
                                        <tr key={`${row.name}-${index}`} className="border-b last:border-b-0">
                                            <th className="w-1/2 bg-muted/40 px-4 py-3 text-left font-medium">
                                                {row.name}
                                            </th>
                                            <td className="px-4 py-3">{row.value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {files.length > 0 && (
                    <div>
                        <h2 className="text-2xl font-bold mb-4">{t('downloads')}</h2>
                        <ul className="divide-y rounded-xl border">
                            {files.map(file => (
                                <li key={file.id}>
                                    <a
                                        href={file.source}
                                        download
                                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted/50"
                                    >
                                        <FileDown className="h-4 w-4 text-primary" />
                                        <span>{file.name}</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    );
}
