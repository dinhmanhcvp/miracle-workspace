// Browser tests: node tests/run-tests.js
// 1) runs the in-app test suite (booking steps) and checks user data is preserved
// 2) runs an end-to-end scenario of the KOC matching flow in a fresh browser
const path = require('path');
const { chromium } = require('playwright');

const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
const check = (ok, name, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + detail}`); if (!ok) failures++; };

const openPage = async (browser) => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(url);
  await page.waitForFunction(() => typeof window.runAutomatedTests === 'function' && typeof window.onTabShown === 'function');
  return { page, errors };
};

(async () => {
  const browser = await chromium.launch();

  // ---------- 1. In-app suite ----------
  {
    const { page, errors } = await openPage(browser);
    // Simulate an existing user upgrading: only legacy keys exist before the new version loads
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('miracle_pnls', JSON.stringify([{ name: 'REAL USER ROW', intCost: 1, extCost: 2, grossProfit: 1 }])); });
    await page.reload();
    await page.waitForFunction(() => typeof window.runAutomatedTests === 'function');
    const { results } = await page.evaluate(() => window.runAutomatedTests({ silent: true }));
    for (const r of results) check(r.pass, r.name, r.message);
    const real = await page.evaluate(() => localStorage.getItem('miracle_pnls'));
    check(real && real.includes('REAL USER ROW'), 'User data preserved after in-app tests');
    const migrated = await page.evaluate(() => ({ bl: JSON.parse(localStorage.getItem('miracle_blacklist_custom') || '[]'), agency: localStorage.getItem('miracle_agency_name') }));
    check(migrated.bl.includes('Sang Blu') && migrated.agency === 'The Miracle', 'Legacy blacklist and agency migrated for existing users', JSON.stringify(migrated));
    check(!errors.length, 'No page errors (suite)', errors.join(' | '));
    await page.close();
  }

  // ---------- 2. KOC matching E2E (fresh profile) ----------
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => d.accept());
    await page.goto(url);
    await page.waitForFunction(() => typeof window.onTabShown === 'function');

    const fresh = await page.evaluate(() => ({ bl: localStorage.getItem('miracle_blacklist_custom'), title: document.getElementById('brand-title').textContent, tab: currentTabId }));
    check(!fresh.bl || fresh.bl === '[]', 'New agency starts with empty blacklist', fresh.bl);
    check(fresh.tab === 'brief' && fresh.title === 'KOC Booking', 'Opens on Brief tab with generic title', JSON.stringify(fresh));
    check(await page.isVisible('#brief-empty-db'), 'Empty-database hint shown');

    // Import via paste (Excel TSV)
    await page.click('text=Kho KOC >> nth=0');
    await page.click('text=Dán từ Excel/Sheets');
    const tsv = 'Tên\tNền tảng\tFollowers\tView TB\tER (%)\tNgành\tGiới tính khán giả\tĐộ tuổi khán giả\tKhu vực\tGiá nhập\n' +
      'Paste KOC One\tTikTok\t150k\t60k\t7\tMỹ phẩm\tNữ\t18-24\tTP.HCM\t6tr\n' +
      '<img src=x onerror=window.__xss=1>\tTikTok\t20k\t5k\t3\tGame\tNam\t13-17\tHà Nội\t2tr\n';
    await page.fill('#paste-text', tsv);
    await page.click('text=Nhập vào Kho KOC');
    await page.waitForTimeout(400);
    const afterPaste = await page.evaluate(() => ({ n: kocs.length, xss: !!window.__xss, img: !!document.querySelector('#koc-tbody img') }));
    check(afterPaste.n === 2, 'Paste import adds 2 KOCs', afterPaste.n);
    check(!afterPaste.xss && !afterPaste.img, 'Imported names are escaped');

    // Demo data
    await page.click('#btn-demo-load');
    const n = await page.evaluate(() => kocs.length);
    check(n === 18, 'Demo data loaded (16 + 2)', n);

    // Brief: quick parse
    await page.click('#btn-tab-brief');
    await page.fill('#brief-raw', 'Brand: Glow Lab\nSản phẩm: serum vitamin C\nCần 4 KOC TikTok review skincare, target nữ 18-30 tuổi tại TP.HCM. Ngân sách 60 triệu, mỗi KOC 1 video 60s. Ưu tiên review chân thật.');
    await page.click('text=Đọc nhanh (không cần AI)');
    const brief = await page.evaluate(() => readBriefForm());
    check(brief.brand === 'Glow Lab' && brief.categories.includes('beauty') && brief.platforms.join() === 'TikTok' && brief.totalBudget === 60000000 && brief.kocCount === 4 && brief.gender === 'nu',
      'Brief parsed into form', JSON.stringify(brief));

    await page.click('#btn-match');
    await page.waitForTimeout(300);
    const res = await page.evaluate(() => ({ top: lastRanking.matches.slice(0, 3).map(r => [r.koc.name, r.score]), excl: lastRanking.excluded.length, cards: document.querySelectorAll('#match-list > div').length }));
    check(res.cards > 0 && /Skincare|Paste KOC One|Linh Unbox|Makeup/.test(res.top[0][0]), 'Top match is a beauty KOC', JSON.stringify(res.top));
    check(res.excl > 0, 'Non-TikTok KOCs excluded', res.excl);

    await page.click('text=Tự chọn shortlist theo ngân sách');
    await page.waitForTimeout(300);
    const sl = await page.evaluate(() => { const rows = getShortlistRows(); return { n: rows.length, total: rows.reduce((s, r) => s + r.price, 0), names: rows.map(r => r.koc.name) }; });
    check(sl.n > 0 && sl.n <= 4 && sl.total <= 60000000, 'Auto shortlist within count and budget', JSON.stringify(sl));
    check(!sl.names.some(x => /Gaming|Tech|img/.test(x)), 'Shortlist excludes off-category KOCs', JSON.stringify(sl.names));

    // Copy for brand must not leak internal cost
    await page.evaluate(() => { window.__clip = ''; copyTextToClipboard = async (t) => { window.__clip = t; }; });
    await page.click('text=Copy gửi brand');
    const clipBrand = await page.evaluate(() => window.__clip);
    check(clipBrand.startsWith('STT\tKOC') && !/Giá nhập|Contact/.test(clipBrand) && clipBrand.split('\n').length === sl.n + 1, 'Brand copy has no internal cost', clipBrand.split('\n')[0]);

    // Hand-off to PNL
    const firstId = await page.evaluate(() => shortlistIds[0]);
    await page.evaluate((id) => sendKocToPnl(id), firstId);
    const pnl = await page.evaluate(() => ({ tab: currentTabId, name: document.getElementById('pnl-name').value, cost: document.getElementById('pnl-cost').value, scope: document.getElementById('pnl-scope').value, ext: document.getElementById('ext-ext-cost').value }));
    check(pnl.tab === 'internal' && pnl.name === sl.names[0] && pnl.cost !== '' && /1 video 60s/.test(pnl.scope) && pnl.ext !== '0', 'Send to PNL fills Proceed Internal', JSON.stringify(pnl));

    // Persistence across reload
    await page.reload();
    await page.waitForFunction(() => typeof window.onTabShown === 'function');
    const persisted = await page.evaluate(() => ({ k: kocs.length, s: shortlistIds.length, b: readBriefForm().brand }));
    check(persisted.k === 18 && persisted.s === sl.n && persisted.b === 'Glow Lab', 'KOCs, shortlist and brief persist after reload', JSON.stringify(persisted));

    // Agency name used in messages
    await page.evaluate(() => { localStorage.setItem('miracle_agency_name', 'ABC Media'); });
    await page.evaluate(() => { document.getElementById('so-name').value = 'An'; document.getElementById('brand-name').value = 'Glow Lab'; document.getElementById('scope-xin-gia').value = '1 video'; });
    await page.evaluate(() => generateXinGia());
    const msg = await page.textContent('#res-xingia');
    check(msg.includes('ABC Media') && !msg.includes('The Miracle'), 'Fallback message uses agency name', msg.slice(0, 120));

    check(!errors.length, 'No page errors (E2E)', errors.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nAll browser tests passed');
  process.exit(failures ? 1 : 0);
})();
