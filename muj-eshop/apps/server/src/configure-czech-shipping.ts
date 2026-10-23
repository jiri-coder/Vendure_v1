import {
    bootstrapWorker,
    ConfigService,
    LanguageCode,
    RequestContextService,
    ShippingMethodService,
    TransactionalConnection,
    User,
} from '@vendure/core';
import { config } from './vendure-config';

interface ShippingDefinition {
    code: string;
    name: string;
    adminLabel: string;
    description: string;
    priceCzk: number;
    minimumSubtotalCzk: number;
    maximumSubtotalCzk: number;
    minimumWeightKg: number;
    maximumWeightKg: number;
}

const shippingDefinitions: ShippingDefinition[] = [
    {
        code: 'courier-0-699',
        name: 'Kurýrní služba',
        adminLabel: 'Hmotnost 0–6,99 kg',
        description: 'Doručení na adresu v ČR',
        priceCzk: 139,
        minimumSubtotalCzk: 0,
        maximumSubtotalCzk: 9_999,
        minimumWeightKg: 0,
        maximumWeightKg: 6.99,
    },
    {
        code: 'courier-7-4999',
        name: 'Kurýrní služba',
        adminLabel: 'Hmotnost 7–49,99 kg',
        description: 'Doručení na adresu v ČR',
        priceCzk: 199,
        minimumSubtotalCzk: 0,
        maximumSubtotalCzk: 9_999,
        minimumWeightKg: 7,
        maximumWeightKg: 49.99,
    },
    {
        code: 'courier-50-49999',
        name: 'Kurýrní služba',
        adminLabel: 'Hmotnost 50–499,99 kg',
        description: 'Doručení na adresu v ČR',
        priceCzk: 390,
        minimumSubtotalCzk: 0,
        maximumSubtotalCzk: 9_999,
        minimumWeightKg: 50,
        maximumWeightKg: 499.99,
    },
    {
        code: 'courier-500-plus',
        name: 'Kurýrní služba',
        adminLabel: 'Hmotnost od 500 kg',
        description: 'Doručení na adresu v ČR',
        priceCzk: 419,
        minimumSubtotalCzk: 0,
        maximumSubtotalCzk: 9_999,
        minimumWeightKg: 500,
        maximumWeightKg: 0,
    },
    {
        code: 'courier-pallet-xl',
        name: 'Kurýrní služba (paletová přeprava XL)',
        adminLabel: 'Paletová XL, 0–2 000 Kč, 500–50 000 kg',
        description: 'Doručení na adresu v ČR',
        priceCzk: 650,
        minimumSubtotalCzk: 0,
        maximumSubtotalCzk: 2_000,
        minimumWeightKg: 500,
        maximumWeightKg: 50_000,
    },
    {
        code: 'courier-pallet-xxl',
        name: 'Kurýrní služba (paletová přeprava XXL)',
        adminLabel: 'Paletová XXL, 2 001–3 000 Kč, 500–50 000 kg',
        description: 'Doručení na adresu v ČR',
        priceCzk: 550,
        minimumSubtotalCzk: 2_001,
        maximumSubtotalCzk: 3_000,
        minimumWeightKg: 500,
        maximumWeightKg: 50_000,
    },
    {
        code: 'courier-cargo-xl',
        name: 'Kurýrní služba (cargo XL)',
        adminLabel: 'Cargo XL, 3 001–4 000 Kč, 500–50 000 kg',
        description: 'Doručení na adresu v ČR',
        priceCzk: 490,
        minimumSubtotalCzk: 3_001,
        maximumSubtotalCzk: 4_000,
        minimumWeightKg: 500,
        maximumWeightKg: 50_000,
    },
    {
        code: 'courier-cargo-xxl',
        name: 'Kurýrní služba (cargo XXL)',
        adminLabel: 'Cargo XXL, od 4 001 Kč, 500–50 000 kg',
        description: 'Doručení na adresu v ČR',
        priceCzk: 450,
        minimumSubtotalCzk: 4_001,
        maximumSubtotalCzk: 0,
        minimumWeightKg: 500,
        maximumWeightKg: 50_000,
    },
    {
        code: 'free-shipping-10000',
        name: 'Doprava zdarma',
        adminLabel: 'Od 10 000 Kč',
        description: 'Pro objednávky od 10 000 Kč',
        priceCzk: 0,
        minimumSubtotalCzk: 10_000,
        maximumSubtotalCzk: 0,
        minimumWeightKg: 0,
        maximumWeightKg: 0,
    },
];

function operation(code: string, values: Record<string, string | number>) {
    return {
        code,
        arguments: Object.entries(values).map(([name, value]) => ({
            name,
            value: String(value),
        })),
    };
}

function shippingMethodInput(definition: ShippingDefinition) {
    return {
        code: definition.code,
        fulfillmentHandler: 'manual-fulfillment',
        checker: operation('czech-shipping-profile', {
            deliveryType: 'HOME_DELIVERY',
            minimumOrderSubtotal: definition.minimumSubtotalCzk * 100,
            maximumOrderSubtotal: definition.maximumSubtotalCzk * 100,
            minimumWeightKg: definition.minimumWeightKg,
            maximumWeightKg: definition.maximumWeightKg,
        }),
        calculator: operation('czech-tiered-shipping-calculator', {
            rate: definition.priceCzk * 100,
            freeShippingFrom: 0,
            includesTax: 'include',
            taxRate: 21,
        }),
        customFields: {
            deliveryType: 'HOME_DELIVERY',
            adminLabel: definition.adminLabel,
        },
        translations: [
            {
                languageCode: LanguageCode.cs,
                name: definition.name,
                description: definition.description,
            },
            {
                languageCode: LanguageCode.en,
                name: definition.name,
                description: definition.description,
            },
        ],
    };
}

async function configureShipping() {
    const worker = await bootstrapWorker(config);
    try {
        const configService = worker.app.get(ConfigService);
        const connection = worker.app.get(TransactionalConnection);
        const requestContextService = worker.app.get(RequestContextService);
        const shippingMethodService = worker.app.get(ShippingMethodService);
        const superadmin = await connection.rawConnection.getRepository(User).findOneOrFail({
            where: {
                identifier: configService.authOptions.superadminCredentials.identifier,
            },
            relations: {
                roles: {
                    channels: true,
                },
            },
        });
        const ctx = await requestContextService.create({
            apiType: 'admin',
            user: superadmin,
            languageCode: LanguageCode.cs,
        });
        const existing = await shippingMethodService.findAll(ctx, { take: 100 });

        for (const definition of shippingDefinitions) {
            const input = shippingMethodInput(definition);
            const current = existing.items.find(method => method.code === definition.code);
            if (current) {
                await shippingMethodService.update(ctx, {
                    id: current.id,
                    ...input,
                });
                console.log(`Aktualizováno: ${definition.code}`);
            } else {
                await shippingMethodService.create(ctx, input);
                console.log(`Vytvořeno: ${definition.code}`);
            }
        }
    } finally {
        await worker.app.close();
    }
}

configureShipping().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
