import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
    ChannelService,
    ConfigService,
    FacetService,
    FacetValueService,
    LanguageCode,
    Logger,
    ProcessContext,
    RequestContextService,
    TransactionalConnection,
    User,
} from '@vendure/core';

/**
 * Standard product filters. A category shows a facet only when that facet
 * is selected in the collection field "Filtry v kategorii".
 */
export const FILTER_FACETS = [
    { code: 'vyska', nameCs: 'Výška', nameEn: 'Height' },
    { code: 'sirka', nameCs: 'Šířka', nameEn: 'Width' },
    { code: 'hloubka', nameCs: 'Hloubka', nameEn: 'Depth' },
    { code: 'vypln', nameCs: 'Výplň', nameEn: 'Glazing' },
    { code: 'otevirani', nameCs: 'Otevírání', nameEn: 'Opening' },
    { code: 'tloustka-skla', nameCs: 'Tloušťka skla', nameEn: 'Glass thickness' },
] as const;

/** Shop badges. One facet, two stable values, so listings can show them from search results. */
export const LABEL_FACET_CODE = 'stitky';

export const LABEL_VALUES = [
    { code: 'novinka', nameCs: 'Novinka', nameEn: 'New' },
    { code: 'akce', nameCs: 'V akci', nameEn: 'On sale' },
] as const;

@Injectable()
export class FilterFacetService implements OnApplicationBootstrap {
    constructor(
        private readonly processContext: ProcessContext,
        private readonly facetService: FacetService,
        private readonly facetValueService: FacetValueService,
        private readonly channelService: ChannelService,
        private readonly configService: ConfigService,
        private readonly requestContextService: RequestContextService,
        private readonly connection: TransactionalConnection,
    ) {}

    async onApplicationBootstrap() {
        if (!this.processContext.isServer) {
            return;
        }

        const channel = await this.channelService.getDefaultChannel();
        const superadmin = await this.connection.rawConnection.getRepository(User).findOne({
            where: {
                identifier: this.configService.authOptions.superadminCredentials.identifier,
            },
            relations: { roles: { channels: true } },
        });
        if (!superadmin) {
            Logger.warn('Filtrační facety nebyly vytvořeny, chybí účet superadmin.', 'FilterFacets');
            return;
        }

        const ctx = await this.requestContextService.create({
            apiType: 'admin',
            channelOrToken: channel,
            languageCode: LanguageCode.cs,
            user: superadmin,
        });

        for (const facet of FILTER_FACETS) {
            const existing = await this.facetService.findByCode(ctx, facet.code, LanguageCode.cs);
            if (existing) {
                continue;
            }
            await this.facetService.create(ctx, {
                code: facet.code,
                isPrivate: false,
                translations: [
                    { languageCode: LanguageCode.cs, name: facet.nameCs },
                    { languageCode: LanguageCode.en, name: facet.nameEn },
                ],
            });
            Logger.info(`Vytvořena filtrační faceta ${facet.nameCs}.`, 'FilterFacets');
        }

        let labels = await this.facetService.findByCode(ctx, LABEL_FACET_CODE, LanguageCode.cs);
        if (!labels) {
            labels = await this.facetService.create(ctx, {
                code: LABEL_FACET_CODE,
                isPrivate: false,
                translations: [
                    { languageCode: LanguageCode.cs, name: 'Štítky' },
                    { languageCode: LanguageCode.en, name: 'Labels' },
                ],
            });
            Logger.info('Vytvořena faceta štítků.', 'FilterFacets');
        }
        const labelValues = await this.facetValueService.findByFacetId(ctx, labels.id);
        for (const value of LABEL_VALUES) {
            if (labelValues.some(existing => existing.code === value.code)) {
                continue;
            }
            await this.facetValueService.create(ctx, labels, {
                code: value.code,
                translations: [
                    { languageCode: LanguageCode.cs, name: value.nameCs },
                    { languageCode: LanguageCode.en, name: value.nameEn },
                ],
            });
            Logger.info(`Vytvořena hodnota štítku ${value.nameCs}.`, 'FilterFacets');
        }
    }
}
