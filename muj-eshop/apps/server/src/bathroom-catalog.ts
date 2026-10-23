export interface CatalogNode {
    name: string;
    slug: string;
    description: string;
    children: CatalogNode[];
}

interface CatalogInput {
    name: string;
    description?: string;
    children?: CatalogInput[];
}

const diacritics: Record<string, string> = {
    á: 'a',
    ä: 'a',
    č: 'c',
    ď: 'd',
    é: 'e',
    ě: 'e',
    í: 'i',
    ň: 'n',
    ó: 'o',
    ř: 'r',
    š: 's',
    ť: 't',
    ú: 'u',
    ů: 'u',
    ý: 'y',
    ž: 'z',
};

function slugPart(name: string): string {
    return name
        .toLowerCase()
        .replace(/[áäčďéěíňóřšťúůýž]/g, character => diacritics[character] ?? character)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function assignSlugs(nodes: CatalogInput[], parentSlug = ''): CatalogNode[] {
    return nodes.map(node => {
        const slug = parentSlug ? `${parentSlug}-${slugPart(node.name)}` : slugPart(node.name);
        return {
            name: node.name,
            slug,
            description: node.description ?? '',
            children: assignSlugs(node.children ?? [], slug),
        };
    });
}

const catalogInput: CatalogInput[] = [
    {
        name: 'Sprchování a sprchové kouty',
        description: 'Kompletní sortiment pro sprchový prostor',
        children: [
            {
                name: 'Sprchové kouty',
                children: [
                    { name: 'Čtvercové, čtvrtkruhové a obdélníkové' },
                    { name: 'Walk-In kouty' },
                ],
            },
            {
                name: 'Sprchové dveře',
                children: [
                    { name: 'Posuvné, křídlové, zalamovací a shrnovací' },
                ],
            },
            { name: 'Sprchové zástěny a stěny' },
            {
                name: 'Sprchové boxy',
                children: [
                    { name: 'S nízkou a hlubokou vaničkou' },
                    { name: 'Parní boxy' },
                ],
            },
            {
                name: 'Sprchové vaničky',
                children: [
                    { name: 'Čtvercové, čtvrtkruhové, obdélníkové a hluboké' },
                    { name: 'Panely a nožičky' },
                ],
            },
            {
                name: 'Sprchy a sprchové systémy',
                children: [
                    { name: 'Sprchové sety, sloupy a panely' },
                    { name: 'Hlavové a ruční sprchy' },
                    { name: 'Tyče, držáky a hadice' },
                ],
            },
            { name: 'Sprchové žlaby, rošty a podlahové vpusti' },
            {
                name: 'Náhradní díly a příslušenství ke sprchovým koutům',
                children: [
                    { name: 'Těsnění, pojezdy, madla, profily a vzpěry' },
                    { name: 'Náhradní skla a stěny' },
                ],
            },
            { name: 'Sprchová sedátka a bezbariérové sprchování' },
            { name: 'Sprchové závěsy a tyče' },
        ],
    },
    {
        name: 'Vany a koupání',
        children: [
            { name: 'Obdélníkové vany' },
            { name: 'Rohové a asymetrické vany' },
            { name: 'Oválné vany' },
            { name: 'Volně stojící vany' },
            { name: 'Vany z litého mramoru' },
            { name: 'Hydromasážní vany' },
            { name: 'Vanové panely, nožičky a podpěry' },
            { name: 'Vanové sifony, výpusti a přepady' },
            { name: 'Podhlavníky a příslušenství k vanám' },
        ],
    },
    {
        name: 'Vodovodní baterie a sprchy',
        children: [
            { name: 'Umyvadlové baterie' },
            {
                name: 'Sprchové baterie',
                children: [
                    { name: 'Nástěnné a podomítkové' },
                ],
            },
            { name: 'Vanové baterie' },
            { name: 'Dřezové baterie' },
            { name: 'Bidetové baterie a bidetové spršky' },
            { name: 'Termostatické baterie' },
            { name: 'Senzorové a bezdotykové baterie' },
            { name: 'Baterie s lékařskou pákou' },
            { name: 'Podomítková montážní tělesa' },
            { name: 'Kartuše, perlátory, výtoková ramínka a páky' },
            { name: 'Příslušenství a náhradní díly k bateriím' },
        ],
    },
    {
        name: 'WC, umyvadla a sanitární keramika',
        children: [
            {
                name: 'Umyvadla a umývátka',
                children: [
                    { name: 'Na desku, závěsná a nábytková' },
                    { name: 'Zápustná a polozápustná' },
                    { name: 'Stojací a volně stojící' },
                    { name: 'Rohová umyvadla' },
                ],
            },
            {
                name: 'WC a toalety',
                children: [
                    { name: 'Závěsné WC' },
                    { name: 'Stojící WC a kombi' },
                    { name: 'Sprchovací a elektronické toalety' },
                    { name: 'WC sedátka' },
                ],
            },
            {
                name: 'Předstěnové instalační moduly',
                children: [
                    { name: 'Moduly pro WC, umyvadla, bidety a pisoáry' },
                    { name: 'Ovládací tlačítka' },
                    { name: 'Splachovací nádržky' },
                ],
            },
            { name: 'Bidety a bidetovací sedátka' },
            {
                name: 'Pisoáry a urinály',
                children: [
                    { name: 'Standardní a bezvodé' },
                    { name: 'Automatické splachovače' },
                ],
            },
            { name: 'Výlevky a speciální keramika' },
            { name: 'Bezbariérová WC a umyvadla' },
            { name: 'Dětská sanitární keramika' },
        ],
    },
    {
        name: 'Koupelnový nábytek a doplňky',
        children: [
            { name: 'Umyvadlové skříňky' },
            { name: 'Skříňky pod umyvadlovou desku' },
            { name: 'Umyvadlové desky a konstrukce' },
            { name: 'Vysoké a nízké skříňky' },
            { name: 'Zrcadla a zrcadlové skříňky' },
            { name: 'Koupelnové sestavy a nábytkové komplety' },
            { name: 'Osvětlení koupelny a zrcadel' },
            { name: 'Držáky ručníků, háčky a věšáky' },
            { name: 'Dávkovače mýdla, mýdlenky a kelímky' },
            { name: 'WC štětky a držáky toaletního papíru' },
            { name: 'Poličky a regály' },
            { name: 'Kosmetická zrcátka' },
            { name: 'Předložky a koupelnový textil' },
            { name: 'Koše na prádlo a odpadkové koše' },
            { name: 'Sedátka, stoličky a další koupelnové pomůcky' },
            { name: 'Osoušeče rukou a vysoušeče' },
            { name: 'Náhradní díly a příslušenství k nábytku' },
        ],
    },
    {
        name: 'Vytápění, radiátory a ohřev vody',
        children: [
            { name: 'Koupelnové radiátory a topné žebříky' },
            { name: 'Designové radiátory' },
            { name: 'Elektrické radiátory' },
            { name: 'Topné tyče a elektrické sušáky' },
            { name: 'Podlahové vytápění a topné rohože' },
            { name: 'Připojovací armatury a ventily' },
            { name: 'Termostatické hlavice a regulace' },
            { name: 'Průtokové a zásobníkové ohřívače vody' },
            { name: 'Tepelná čerpadla' },
            { name: 'Cirkulační čerpadla' },
            { name: 'Ventilace a koupelnové ventilátory' },
            { name: 'Příslušenství a náhradní díly k vytápění' },
        ],
    },
    {
        name: 'Instalatérské potřeby a voda',
        children: [
            {
                name: 'Sifony a odtoky',
                children: [
                    { name: 'Umyvadlové, dřezové a vanové' },
                ],
            },
            { name: 'Flexi hadičky a připojovací roháčky' },
            { name: 'Trubky, tvarovky a fitinky' },
            { name: 'Odpadní a kanalizační systémy' },
            { name: 'Tlakové rozvody a izolace' },
            { name: 'Kulové kohouty a ventily pro vodu a plyn' },
            { name: 'Zahradní a nezámrzné ventily' },
            { name: 'Zahradní hadice, spojky a spony' },
            { name: 'Vodní filtry a filtrace' },
            { name: 'Průmyslové a venkovní odvodnění' },
            {
                name: 'Stavební chemie',
                children: [
                    { name: 'Silikony, tmely, lepidla a čističe' },
                ],
            },
            { name: 'Instalatérské nářadí a revizní dvířka' },
        ],
    },
    {
        name: 'Kuchyně a dřezy',
        children: [
            {
                name: 'Kuchyňské dřezy',
                children: [
                    { name: 'Granitové, nerezové, keramické a tectonitové' },
                ],
            },
            { name: 'Kuchyňské baterie' },
            { name: 'Drtiče kuchyňského odpadu' },
            { name: 'Sortery a odpadkové koše' },
            { name: 'Vodní filtry pro kuchyně, lednice a kávovary' },
            {
                name: 'Digestoře',
                children: [
                    { name: 'Komínové a vestavné' },
                    { name: 'Příslušenství k digestořím' },
                ],
            },
        ],
    },
    {
        name: 'Zahrada a bazény',
        children: [
            { name: 'Bazény a bazénové příslušenství' },
            { name: 'Bazénová filtrace' },
            { name: 'Zahradní zavlažování' },
            { name: 'Zahradní hadice a příslušenství' },
            { name: 'Zahradní ventily' },
            { name: 'Zahradní nábytek' },
            { name: 'Zahradní nářadí' },
            { name: 'Květináče a další zahradní vybavení' },
        ],
    },
];

export const bathroomCatalog = assignSlugs(catalogInput);

function assertUniqueSlugs(nodes: CatalogNode[], seen = new Set<string>()) {
    for (const node of nodes) {
        if (node.slug.length > 255) {
            throw new Error(`Slug je delší než 255 znaků: ${node.slug}`);
        }
        if (seen.has(node.slug)) {
            throw new Error(`Duplicitní slug katalogu: ${node.slug}`);
        }
        seen.add(node.slug);
        assertUniqueSlugs(node.children, seen);
    }
}

assertUniqueSlugs(bathroomCatalog);
