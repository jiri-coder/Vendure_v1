import { DeepPartial, EntityId, ID, Order, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

@Entity()
export class ShopInvoice extends VendureEntity {
    constructor(input?: DeepPartial<ShopInvoice>) {
        super(input);
    }

    @Column({ unique: true })
    number: string;

    @Index({ unique: true })
    @EntityId()
    orderId: ID;

    @ManyToOne(() => Order, { onDelete: 'CASCADE' })
    order: Order;

    @Column()
    issuedAt: Date;

    @Column()
    currencyCode: string;

    @Column('int')
    totalWithTax: number;

    @Column({ type: 'varchar', length: 255 })
    sellerName: string;

    @Column({ type: 'text', default: '' })
    sellerAddress: string;

    @Column({ type: 'varchar', length: 64, default: '' })
    sellerIco: string;

    @Column({ type: 'varchar', length: 64, default: '' })
    sellerDic: string;

    @Column({ type: 'varchar', length: 64, default: '' })
    sellerIban: string;

    @Column({ type: 'varchar', length: 255, default: '' })
    buyerName: string;

    @Column({ type: 'varchar', length: 255, default: '' })
    buyerCompany: string;

    @Column({ type: 'varchar', length: 255, default: '' })
    buyerStreet: string;

    @Column({ type: 'varchar', length: 128, default: '' })
    buyerCity: string;

    @Column({ type: 'varchar', length: 32, default: '' })
    buyerPostalCode: string;

    @Column({ type: 'varchar', length: 128, default: '' })
    buyerCountry: string;

    @Column({ type: 'varchar', length: 64, default: '' })
    buyerIco: string;

    @Column({ type: 'varchar', length: 64, default: '' })
    buyerDic: string;

    @Column({ type: 'varchar', length: 255, default: '' })
    buyerEmail: string;

    @OneToMany(() => ShopInvoiceLine, line => line.invoice, { cascade: true, eager: true })
    lines: ShopInvoiceLine[];
}

@Entity()
export class ShopInvoiceLine extends VendureEntity {
    constructor(input?: DeepPartial<ShopInvoiceLine>) {
        super(input);
    }

    @ManyToOne(() => ShopInvoice, invoice => invoice.lines, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'invoiceId' })
    invoice: ShopInvoice;

    @EntityId()
    invoiceId: ID;

    @Column('int')
    position: number;

    @Column({ type: 'varchar', length: 500 })
    description: string;

    @Column('int')
    quantity: number;

    @Column('int')
    unitPriceWithTax: number;

    @Column('double precision')
    taxRate: number;
}
