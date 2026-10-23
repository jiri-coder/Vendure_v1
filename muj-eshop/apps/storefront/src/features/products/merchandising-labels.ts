import {cacheLife, cacheTag} from 'next/cache';
import {query} from '@/platform/vendure/api';
import {graphql} from '@/platform/vendure/graphql';

const MerchandisingLabelsQuery = graphql(`
    query MerchandisingLabels {
        facets(options: {filter: {code: {eq: "stitky"}}, take: 1}) {
            items {
                values {
                    id
                    code
                }
            }
        }
    }
`);

export async function getMerchandisingLabels(locale: string) {
    'use cache';
    cacheLife('hours');
    cacheTag(`merchandising-labels-${locale}`);

    const result = await query(MerchandisingLabelsQuery, undefined, {
        languageCode: locale,
        fetch: {cache: 'force-cache', next: {revalidate: 3600, tags: [`merchandising-labels-${locale}`]}},
    });
    const values = result.data.facets.items[0]?.values ?? [];
    return {
        novinkaId: values.find(value => value.code === 'novinka')?.id ?? null,
        akceId: values.find(value => value.code === 'akce')?.id ?? null,
    };
}
