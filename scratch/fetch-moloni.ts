import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function test() {
    const res = await fetch('https://www.moloni.pt/dev/documents/invoices/');
    const html = await res.text();
    fs.writeFileSync('./scratch/moloni-invoices.html', html);
    console.log("Done");
}

test();
