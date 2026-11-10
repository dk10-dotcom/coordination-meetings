// Turns a sample agenda into the in-app example: SAMPLE watermark, and no hidden data so it can't be loaded as last week.
const fs = require('fs');
const { PDFDocument, PDFName, StandardFonts, rgb, degrees } = require('../site/vendor/pdf-lib.min.js');
(async () => {
  const [src, out] = process.argv.slice(2);
  const doc = await PDFDocument.load(fs.readFileSync(src));
  doc.getInfoDict().delete(PDFName.of('HuddleData'));
  doc.setTitle('Sample Weekly Coordination Meeting Agenda');
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize(); const size = 120, text = 'SAMPLE';
    const w = font.widthOfTextAtSize(text, size);
    const a = Math.atan2(height, width);
    page.drawText(text, { x: width / 2 - (w / 2) * Math.cos(a) + (size * 0.35) * Math.sin(a), y: height / 2 - (w / 2) * Math.sin(a) - (size * 0.35) * Math.cos(a), size, font, color: rgb(0.85, 0.2, 0.2), opacity: 0.12, rotate: degrees(a * 180 / Math.PI) });
  }
  fs.writeFileSync(out, await doc.save());
})().catch(e => { console.error(e); process.exit(1); });
