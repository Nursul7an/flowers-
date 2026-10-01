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
    s.setAttribute('width', '400');
    s.setAttribute('height', '490');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(s);
  });
  writeFileSync('assets/bouquet.svg', svg);
  await page.close();
}

// 2. Open Graph preview 1200×630
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, ignoreHTTPSErrors: true });
  await page.goto(BASE + '?poster');
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: `
    #sound, #intro, #finale { display: none !important; }
    .og-title { position: absolute; left: 70px; top: 0; bottom: 0; width: 560px; z-index: 4;
      display: flex; flex-direction: column; justify-content: center; text-align: center; }
    .og-title .small { font-family: var(--script); font-size: 64px; color: var(--ink);
      text-shadow: 0 0 18px rgba(255,217,160,.4); }
    .og-title .big { font-family: var(--script); font-size: 150px; line-height: 1.05; color: #FFE9F0;
      text-shadow: 0 0 24px rgba(247,140,175,.95), 0 0 60px rgba(231,127,160,.75); }
    .og-title .sub { font-family: var(--serif); font-style: italic; font-size: 34px; color: var(--ink-soft); margin-top: 10px; }
  `});
  await page.evaluate(() => {
    const { particles } = window.Flowers.debug;
    const wrap = document.querySelector('#bouquet-wrap');
    wrap.style.left = '74%'; wrap.style.height = '610px'; wrap.style.width = (610 * 400 / 490) + 'px';
    wrap.style.bottom = '-4px';
    const t = document.createElement('div');
    t.className = 'og-title';
    t.innerHTML = '<div class="small">Эти цветы — для</div><div class="big">Дарии</div><div class="sub">открой 🌸</div>';
    document.querySelector('#stage').appendChild(t);
    particles.snapshot(14);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'assets/og.jpg', type: 'jpeg', quality: 86 });
  await page.close();
}
await browser.close();
console.log('assets/og.jpg + assets/bouquet.svg written');
