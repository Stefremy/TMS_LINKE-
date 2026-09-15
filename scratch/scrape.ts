import puppeteer from 'puppeteer';

async function testPuppeteer() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  try {
     console.log('Navigating...');
     await page.goto('https://www.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?objects=EQ418727568PT', { waitUntil: 'networkidle0', timeout: 30000 });
     
     await new Promise(r => setTimeout(r, 5000));
     
     const content = await page.evaluate(() => {
        // extract all text nodes that have length > 0
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        let node;
        const texts = [];
        while (node = walker.nextNode()) {
           const t = node.textContent?.trim();
           if (t && t.length > 5 && !t.includes('function') && !t.includes('{')) {
              texts.push(t);
           }
        }
        return texts;
     });
     
     // look for dates or statuses
     console.log('Checking texts for dates or known statuses...');
     for (let i = 0; i < content.length; i++) {
        const text = content[i];
        if (text.includes('Aceite') || text.includes('Recolhid') || text.includes('Trânsito') || /\d{2,4}[-\/]\d{2}/.test(text)) {
           console.log(`[${i}] MATCH: ${text}`);
           // print surrounding context
           console.log(`Context: ${content.slice(Math.max(0, i-2), i+3).join(' | ')}`);
        }
     }
     
  } catch(e) {
     console.error(e);
  } finally {
     await browser.close();
  }
}
testPuppeteer().catch(console.error);
