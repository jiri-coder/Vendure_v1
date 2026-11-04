import { Button } from '@vendure/dashboard';
import { Link } from '@tanstack/react-router';
import { Globe, Mail, Phone, User } from 'lucide-react';

type OrderAddress = {
    fullName?: string | null;
    company?: string | null;
    streetLine1?: string | null;
    streetLine2?: string | null;
    city?: string | null;
    province?: string | null;
    postalCode?: string | null;
    country?: string | { code?: string | null; name?: string | null } | null;
    countryCode?: string | null;
    phoneNumber?: string | null;
};

type OrderCustomer = {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    emailAddress?: string | null;
};

type OrderEntity = {
    customer?: OrderCustomer | null;
    shippingAddress?: OrderAddress | null;
    billingAddress?: OrderAddress | null;
};

function countryLabel(address: OrderAddress) {
    const country = address.country;
    const countryName = typeof country === 'string' ? country : country?.name;
    const countryCode = typeof country === 'string' ? address.countryCode : country?.code ?? address.countryCode;
    return { countryName, countryCode };
}

function AddressDetails({
    address,
    email,
}: {
    address: OrderAddress;
    email?: string | null;
}) {
    const { countryName, countryCode } = countryLabel(address);
    const values = Object.values(address);
    if (values.every(value => !value) && !email) {
        return <div className="text-sm text-muted-foreground">Bez adresy</div>;
    }

    return (
        <div className="space-y-1 text-sm">
            {address.fullName ? <p className="font-medium">{address.fullName}</p> : null}
            {address.company ? <p className="text-sm text-muted-foreground">{address.company}</p> : null}
            <div>
                {address.streetLine1 ? <p>{address.streetLine1}</p> : null}
                {address.streetLine2 ? <p>{address.streetLine2}</p> : null}
                <p>{[address.city, address.province].filter(Boolean).join(', ')}</p>
                {address.postalCode ? <p>{address.postalCode}</p> : null}
                {countryName ? (
                    <div className="flex items-center gap-1.5">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        <span>{countryName}</span>
                        {countryCode ? (
                            <span className="text-xs text-muted-foreground">({countryCode})</span>
                        ) : null}
                    </div>
                ) : null}
                {address.phoneNumber ? (
                    <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{address.phoneNumber}</span>
                    </div>
                ) : null}
                {email ? (
                    <div className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <a href={`mailto:${email}`} className="text-sm break-all">
                            {email}
                        </a>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export function OrderCustomerBlock({
    context,
}: {
    context: { entity?: OrderEntity };
}) {
    const entity = context.entity;
    const customer = entity?.customer;
    const email = customer?.emailAddress?.trim() || null;

    return (
        <div>
            {customer ? (
                <Button variant="outline" render={<Link to={`/customers/${customer.id}`} />}>
                    <User className="w-4 h-4" />
                    {customer.firstName} {customer.lastName}
                </Button>
            ) : (
                <div className="text-muted-foreground text-xs font-medium p-3 border rounded-md">
                    Bez zákazníka
                </div>
            )}
            <div className="mt-4 divide-y">
                {entity?.shippingAddress ? (
                    <div className="pb-6">
                        <div className="font-medium mb-6">Doručovací adresa</div>
                        <AddressDetails address={entity.shippingAddress} email={email} />
                    </div>
                ) : email ? (
                    <div className="pb-6">
                        <div className="flex items-center gap-1.5 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <a href={`mailto:${email}`} className="break-all">
                                {email}
                            </a>
                        </div>
                    </div>
                ) : null}
                {entity?.billingAddress ? (
                    <div className={entity.shippingAddress ? 'pt-4' : ''}>
                        <div className="font-medium mb-6">Fakturační adresa</div>
                        <AddressDetails address={entity.billingAddress} />
                    </div>
                ) : null}
            </div>
        </div>
    );
}
