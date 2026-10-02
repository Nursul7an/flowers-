// Regenerates assets/og.jpg (link preview) and assets/bouquet.svg (no-JS fallback).
// Usage: npx http-server -p 8080 .   then   node tools/render-assets.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:8080/';
const browser = await chromium.launch();

// 1. static bouquet SVG
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE + '?poster');
  await page.waitForTimeout(500);
  const svg = await page.evaluate(() => {
    const s = window.Flowers.debug.bouquet.svg.cloneNode(true);
    s.removeAttribute('style');
    s.setAttribute('width', '440');
    s.setAttribute('height', '590');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(s);
  });
  writeFileSync('assets/bouquet.svg', svg);
  await page.close();
}

// 2. Open Graph preview 1200×630
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, ignoreHTTPSErrors: true });
  await page.goto(BASE + '?poster');
  await page.evaluate(() => document.fonts.load('48px "Marck Script"', 'Дария'));
  await page.waitForFunction(() => document.fonts.check('48px "Marck Script"', 'Дария'), null, { timeout: 15000 });
  await page.addStyleTag({ content: `
    #sound, #intro, #finale, #congrats { display: none !important; }
    .og-title { position: absolute; left: 70px; top: 0; bottom: 0; width: 560px; z-index: 4;
      display: flex; flex-direction: column; justify-content: center; text-align: center; }
    .og-title .small { font-family: var(--script); font-size: 54px; white-space: nowrap; color: var(--ink);
      text-shadow: 0 0 18px rgba(255,217,160,.5), 0 2px 6px rgba(20,10,40,.8); }
    .og-title .big { font-family: var(--script); font-size: 150px; line-height: 1.05; color: #FFE9F0;
      text-shadow: 0 0 24px rgba(247,140,175,.95), 0 0 60px rgba(231,127,160,.75); }
    .og-title .sub { font-family: var(--serif); font-style: italic; font-size: 32px; color: #FFF1F4; margin-top: 10px; text-shadow: 0 2px 6px rgba(20,10,40,.9); }
  `});
  await page.evaluate(() => {
    const { particles } = window.Flowers.debug;
    const wrap = document.querySelector('#bouquet-wrap');
    wrap.style.left = '74%'; wrap.style.height = '610px'; wrap.style.width = (610 * 440 / 590) + 'px';
    wrap.style.bottom = '-4px';
    const t = document.createElement('div');
    t.className = 'og-title';
    t.innerHTML = '<div class="small">Это для тебя,</div><div class="big">Дария</div><div class="sub">одна вершина, один закат и цветы 🌸</div>';
    document.querySelector('#stage').appendChild(t);
    particles.snapshot(14);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'assets/og.jpg', type: 'jpeg', quality: 86 });
  await page.close();
}
await browser.close();
console.log('assets/og.jpg + assets/bouquet.svg written');
