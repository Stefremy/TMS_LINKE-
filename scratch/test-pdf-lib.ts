import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

// Helper to convert 0-1 rgb to pdf-lib rgb
const c = (r: number, g: number, b: number) => rgb(r, g, b);

async function createTestPdf() {
  const doc = await PDFDocument.create();
  const fontNormal = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  
  const logoBytes = fs.readFileSync(path.join(process.cwd(), 'public/Linke-logo.png'));
  const logo = await doc.embedPng(logoBytes);
  const logoDims = logo.scale(0.25); // Scale down

  const width = 595.28;
  const height = 841.89;
  const page = doc.addPage([width, height]);
  
  const y = (val: number) => val; // No dynamic height for this test

  // Top Banner
  page.drawRectangle({
    x: 25, y: y(780), width: 545.28, height: 42,
    color: c(0.06, 0.09, 0.16)
  });
  
  // Logo
  page.drawImage(logo, {
    x: 35,
    y: y(780) + (42 - logoDims.height) / 2,
    width: logoDims.width,
    height: logoDims.height
  });

  const pdfBytes = await doc.save();
  fs.writeFileSync('scratch/test.pdf', pdfBytes);
  console.log("PDF generated!");
}

createTestPdf().catch(console.error);
