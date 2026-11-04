import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { ShopInvoice, ShopInvoiceLine } from './invoice-entities';

function fontDir(): string {
    let packaged: string | undefined;
    try {
        packaged = path.join(path.dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
    } catch {
        packaged = undefined;
    }
    const candidates = [
        path.join(process.cwd(), 'static', 'fonts'),
        path.join(__dirname, '../../../static/fonts'),
        path.join(__dirname, '../../../../static/fonts'),
        ...(packaged ? [packaged] : []),
    ];
    return candidates.find(dir => fs.existsSync(path.join(dir, 'DejaVuSans.ttf'))) ?? candidates[0];
}

function formatCzk(halere: number): string {
    return `${(halere / 100).toLocaleString('cs-CZ', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} Kč`;
}

function formatDate(value: Date): string {
    return new Date(value).toLocaleDateString('cs-CZ');
}

function lineTotal(line: ShopInvoiceLine): number {
    return line.quantity * line.unitPriceWithTax;
}

function vatFromGross(gross: number, taxRate: number): number {
    if (taxRate <= 0) {
        return 0;
    }
    return Math.round(gross - gross / (1 + taxRate / 100));
}

export function buildInvoicePdf(invoice: ShopInvoice): Promise<Buffer> {
    const regular = path.join(fontDir(), 'DejaVuSans.ttf');
    const bold = path.join(fontDir(), 'DejaVuSans-Bold.ttf');
    if (!fs.existsSync(regular) || !fs.existsSync(bold)) {
        throw new Error(`Invoice fonts are missing in ${fontDir()}`);
    }

    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Faktura ${invoice.number}` } });
        doc.on('data', chunk => chunks.push(chunk as Buffer));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.registerFont('Regular', regular);
        doc.registerFont('Bold', bold);

        doc.font('Bold').fontSize(18).text('Faktura – daňový doklad');
        doc.moveDown(0.3);
        doc.font('Regular').fontSize(11).text(`Číslo: ${invoice.number}`);
        doc.text(`Datum vystavení: ${formatDate(invoice.issuedAt)}`);
        doc.text(`DUZP: ${formatDate(invoice.issuedAt)}`);
        doc.moveDown();

        const top = doc.y;
        doc.font('Bold').fontSize(11).text('Dodavatel', 48, top);
        doc.font('Regular').fontSize(10);
        doc.text(invoice.sellerName, 48, top + 16, { width: 240 });
        if (invoice.sellerAddress) {
            doc.text(invoice.sellerAddress, { width: 240 });
        }
        if (invoice.sellerIco) {
            doc.text(`IČO: ${invoice.sellerIco}`);
        }
        if (invoice.sellerDic) {
            doc.text(`DIČ: ${invoice.sellerDic}`);
        }
        if (invoice.sellerIban) {
            doc.text(`IBAN: ${invoice.sellerIban}`);
        }

        doc.font('Bold').fontSize(11).text('Odběratel', 320, top);
        doc.font('Regular').fontSize(10);
        let buyerY = top + 16;
        doc.text(invoice.buyerCompany || invoice.buyerName, 320, buyerY, { width: 230 });
        buyerY = doc.y;
        if (invoice.buyerCompany && invoice.buyerName) {
            doc.text(invoice.buyerName, 320, buyerY, { width: 230 });
            buyerY = doc.y;
        }
        if (invoice.buyerStreet) {
            doc.text(invoice.buyerStreet, 320, buyerY, { width: 230 });
            buyerY = doc.y;
        }
        const cityLine = [invoice.buyerPostalCode, invoice.buyerCity].filter(Boolean).join(' ');
        if (cityLine) {
            doc.text(cityLine, 320, buyerY, { width: 230 });
            buyerY = doc.y;
        }
        if (invoice.buyerCountry) {
            doc.text(invoice.buyerCountry, 320, buyerY, { width: 230 });
            buyerY = doc.y;
        }
        if (invoice.buyerIco) {
            doc.text(`IČO: ${invoice.buyerIco}`, 320, buyerY, { width: 230 });
            buyerY = doc.y;
        }
        if (invoice.buyerDic) {
            doc.text(`DIČ: ${invoice.buyerDic}`, 320, buyerY, { width: 230 });
        }

        doc.y = Math.max(doc.y, top + 120);
        doc.moveDown();

        const tableTop = doc.y;
        const cols = { desc: 48, qty: 330, price: 390, total: 470 };
        doc.font('Bold').fontSize(9);
        doc.text('Položka', cols.desc, tableTop, { width: 270 });
        doc.text('Množ.', cols.qty, tableTop, { width: 50, align: 'right' });
        doc.text('Cena', cols.price, tableTop, { width: 70, align: 'right' });
        doc.text('Celkem', cols.total, tableTop, { width: 80, align: 'right' });
        doc.moveTo(48, tableTop + 14).lineTo(547, tableTop + 14).stroke();

        let y = tableTop + 20;
        doc.font('Regular').fontSize(9);
        const lines = [...(invoice.lines ?? [])].sort((a, b) => a.position - b.position);
        for (const line of lines) {
            const height = doc.heightOfString(line.description, { width: 270 });
            if (y + height > 720) {
                doc.addPage();
                y = 48;
            }
            doc.text(line.description, cols.desc, y, { width: 270 });
            doc.text(String(line.quantity), cols.qty, y, { width: 50, align: 'right' });
            doc.text(formatCzk(line.unitPriceWithTax), cols.price, y, { width: 70, align: 'right' });
            doc.text(formatCzk(lineTotal(line)), cols.total, y, { width: 80, align: 'right' });
            y += Math.max(height, 14) + 6;
        }

        doc.moveTo(48, y).lineTo(547, y).stroke();
        y += 12;

        const vatByRate = new Map<number, { base: number; vat: number }>();
        for (const line of lines) {
            const gross = lineTotal(line);
            const vat = vatFromGross(gross, line.taxRate);
            const current = vatByRate.get(line.taxRate) ?? { base: 0, vat: 0 };
            current.base += gross - vat;
            current.vat += vat;
            vatByRate.set(line.taxRate, current);
        }

        doc.font('Regular').fontSize(10);
        for (const [rate, amounts] of [...vatByRate.entries()].sort((a, b) => a[0] - b[0])) {
            if (rate <= 0) {
                continue;
            }
            doc.text(`Základ DPH ${rate} %: ${formatCzk(amounts.base)}`, 320, y, { width: 230, align: 'right' });
            y += 14;
            doc.text(`DPH ${rate} %: ${formatCzk(amounts.vat)}`, 320, y, { width: 230, align: 'right' });
            y += 14;
        }

        doc.font('Bold').fontSize(12);
        doc.text(`Celkem k úhradě: ${formatCzk(invoice.totalWithTax)}`, 320, y, { width: 230, align: 'right' });
        y += 28;
        doc.font('Regular').fontSize(8).fillColor('#444444');
        doc.text(
            'Ceny položek jsou včetně DPH. Tento doklad byl vystaven elektronicky a je platný bez podpisu.',
            48,
            y,
            { width: 500 },
        );

        doc.end();
    });
}
