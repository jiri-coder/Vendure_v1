import {
    LanguageCode,
    ShippingCalculator,
} from '@vendure/core';

const taxSettingOptions = [
    {
        label: [
            { languageCode: LanguageCode.cs, value: 'Cena obsahuje DPH' },
            { languageCode: LanguageCode.en, value: 'Includes tax' },
        ],
        value: 'include',
    },
    {
        label: [
            { languageCode: LanguageCode.cs, value: 'Cena neobsahuje DPH' },
            { languageCode: LanguageCode.en, value: 'Excludes tax' },
        ],
        value: 'exclude',
    },
    {
        label: [
            { languageCode: LanguageCode.cs, value: 'Automaticky podle kanálu' },
            { languageCode: LanguageCode.en, value: 'Auto (based on channel)' },
        ],
        value: 'auto',
    },
];

export const czechTieredShippingCalculator = new ShippingCalculator({
    code: 'czech-tiered-shipping-calculator',
    description: [
        {
            languageCode: LanguageCode.cs,
            value: 'Pevná cena dopravy s dopravou zdarma od nastavené hodnoty zboží',
        },
        {
            languageCode: LanguageCode.en,
            value: 'Flat-rate shipping with free shipping above a merchandise threshold',
        },
    ],
    args: {
        rate: {
            type: 'int',
            defaultValue: 0,
            ui: { component: 'currency-form-input' },
            label: [
                { languageCode: LanguageCode.cs, value: 'Cena dopravy' },
                { languageCode: LanguageCode.en, value: 'Shipping price' },
            ],
        },
        freeShippingFrom: {
            type: 'int',
            defaultValue: 0,
            ui: { component: 'currency-form-input' },
            label: [
                { languageCode: LanguageCode.cs, value: 'Doprava zdarma od hodnoty zboží' },
                { languageCode: LanguageCode.en, value: 'Free shipping from merchandise total' },
            ],
        },
        includesTax: {
            type: 'string',
            defaultValue: 'auto',
            ui: {
                component: 'select-form-input',
                options: taxSettingOptions,
            },
            label: [
                { languageCode: LanguageCode.cs, value: 'DPH v ceně dopravy' },
                { languageCode: LanguageCode.en, value: 'Price includes tax' },
            ],
        },
        taxRate: {
            type: 'float',
            defaultValue: 21,
            ui: { component: 'number-form-input', suffix: '%', min: 0 },
            label: [
                { languageCode: LanguageCode.cs, value: 'Sazba DPH' },
                { languageCode: LanguageCode.en, value: 'Tax rate' },
            ],
        },
    },
    calculate: (ctx, order, args) => {
        const merchandiseTotal = order.lines.reduce(
            (total, line) => total + line.proratedLinePriceWithTax,
            0,
        );
        const freeShipping = args.freeShippingFrom > 0 &&
            merchandiseTotal >= args.freeShippingFrom;

        return {
            price: freeShipping ? 0 : args.rate,
            taxRate: args.taxRate,
            priceIncludesTax: args.includesTax === 'auto'
                ? ctx.channel.pricesIncludeTax
                : args.includesTax === 'include',
        };
    },
});
