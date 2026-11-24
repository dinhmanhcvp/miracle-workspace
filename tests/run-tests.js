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

  // ---------- 3. Bookmarklet on a simulated TikTok page ----------
  {
    const fs = require('fs');
    const root = path.resolve(__dirname, '..');
    const ctx = await browser.newContext();
    const errors = [];
    let geminiPrompt = '';
    // Serve the tool over https (TikTok pages cannot navigate to file://)
    await ctx.route('https://tool.test/**', (route) => {
      const p = new URL(route.request().url()).pathname.replace(/^\//, '') || 'index.html';
      const file = path.join(root, p);
      if (!file.startsWith(root) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      route.fulfill({ body: fs.readFileSync(file), contentType: p.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' });
    });
    const userDetail = { userInfo: { user: { uniqueId: 'demo_koc', nickname: 'Demo Skincare', signature: 'Review skincare chân thật, Sài Gòn' }, stats: { followerCount: 152000, heartCount: 3000000, videoCount: 200 } } };
    const item = (id, desc, views, pinned) => `<div data-e2e="user-post-item"><a href="https://www.tiktok.com/@demo_koc/video/${id}"><img alt="${desc} created by Demo Skincare with original sound"></a><strong data-e2e="video-views">${views}</strong>${pinned ? '<div data-e2e="video-card-badge">Đã ghim</div>' : ''}</div>`;
    const profileHtml = `<html><body><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: { 'webapp.user-detail': userDetail } })}</script>
      <h1 data-e2e="user-title">demo_koc</h1><h2 data-e2e="user-subtitle">Demo Skincare</h2>
      ${item(1, 'Review serum vitamin C cho da dầu #reviewskincare #fyp', '45.2K', false)}
      ${item(2, 'Kem chống nắng nâng tone #skincare', '60K', false)}
      ${item(3, 'Săn sale mỹ phẩm, mã giảm giá ở giỏ hàng #quangcao #skincare', '38K', false)}
      ${item(4, 'Video viral', '2.1M', true)}
      </body></html>`;
    const videoItem = { id: '123', desc: 'Test serum 7 ngày #skincare', stats: { playCount: 100000, diggCount: 9000, commentCount: 600, shareCount: 400 },
      author: { uniqueId: 'demo_koc', nickname: 'Demo Skincare' }, authorStats: { followerCount: 152000, heartCount: 3000000, videoCount: 200 },
      video: { subtitleInfos: [{ LanguageCodeName: 'eng-US', Url: 'https://sub.test/en.vtt' }, { LanguageCodeName: 'vie-VN', Url: 'https://sub.test/vi.vtt' }] } };
    const videoHtml = (dataId) => `<html><body><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: { 'webapp.video-detail': { itemInfo: { itemStruct: { ...videoItem, id: dataId } } } } })}</script>
      <span data-e2e="browse-username">Demo Skincare</span><div data-e2e="browse-video-desc">Test serum 7 ngày</div></body></html>`;
    await ctx.route('https://www.tiktok.com/**', (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === '/@demo_koc') return route.fulfill({ body: profileHtml, contentType: 'text/html; charset=utf-8' });
      if (u.pathname === '/@demo_koc/video/123') return route.fulfill({ body: videoHtml('123'), contentType: 'text/html; charset=utf-8' });
      if (u.pathname === '/@demo_koc/video/999') return route.fulfill({ body: videoHtml('123'), contentType: 'text/html; charset=utf-8' }); // stale SPA data
      route.fulfill({ status: 404, body: '' });
    });
    await ctx.route('https://sub.test/**', (route) => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'text/vtt',
      body: route.request().url().endsWith('vi.vtt') ? 'WEBVTT\n\n00:00.000 --> 00:02.000\nHôm nay mình test serum vitamin C cho da dầu mụn\n' : 'WEBVTT\n\n00:00.000 --> 00:02.000\nEnglish line\n' }));
    await ctx.route('https://generativelanguage.googleapis.com/**', (route) => {
      geminiPrompt = JSON.parse(route.request().postData()).contents[0].parts[0].text;
      const ai = { categories: ['beauty'], gender: 'nu', ages: ['18-24', '25-34'], location: 'TP.HCM', contentStyle: 'Review chân thật, quay cận cảnh', audienceGuess: 'Nữ 18-30 da dầu', brandSafety: 'an toàn', brandSafetyNotes: '', competitorMentions: ['Brand Y'], fitScore: 88, fitReasons: ['Đúng ngành skincare'], summary: 'Kênh review skincare uy tín.' };
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify(ai) + '\n```' }] } }] }) });
    });

    const TOOL = 'https://tool.test/index.html';
    const tool = await ctx.newPage();
    tool.on('pageerror', (e) => errors.push(e.message));
    await tool.goto(TOOL);
    await tool.waitForFunction(() => typeof buildGrabBookmarklet === 'function');
    await tool.evaluate(() => fillBriefForm(KocMatcher.normalizeBrief({ brand: 'Glow Lab', categories: ['beauty'], platforms: ['TikTok'], gender: 'nu', ages: ['18-24'], locations: ['TP.HCM'], totalBudget: 50000000, kocCount: 5 })));
    const code = await tool.evaluate((u) => buildGrabBookmarklet(u), TOOL);
    check(code.startsWith('javascript:') && code.length < 20000, 'Bookmarklet code generated', code.length);

    const tiktok = await ctx.newPage();
    const runBookmarklet = async (url) => {
      await tiktok.goto(url);
      const [popup] = await Promise.all([ctx.waitForEvent('page'), tiktok.evaluate((c) => { (0, eval)(decodeURIComponent(c.slice('javascript:'.length))); }, code)]);
      popup.on('pageerror', (e) => errors.push(e.message));
      await popup.waitForURL(/tool\.test/);
      await popup.waitForSelector('#grab-modal.flex', { timeout: 5000 });
      await popup.waitForTimeout(300);
      return popup;
    };

    // Profile (no API key -> rule-based)
    let p1 = await runBookmarklet('https://www.tiktok.com/@demo_koc');
    let body = await p1.textContent('#grab-body');
    check(body.includes('Demo Skincare') && body.includes('152K') && body.includes('45.2K'), 'Profile grab: name, followers, median views (pinned excluded)', body.slice(0, 200));
    check(/Làm đẹp/.test(body) && body.includes('#skincare') && body.includes('25%'), 'Profile grab: category, hashtags, sponsored ratio', body);
    check(/điểm theo brief Glow Lab/.test(body), 'Profile grab: scored against current brief');
    check(await p1.evaluate(() => location.hash === '#brief'), 'Grab payload removed from URL');
    await p1.click('#btn-grab-save');
    let saved = await p1.evaluate(() => kocs.find(k => k.link === 'https://www.tiktok.com/@demo_koc'));
    check(saved && saved.followers === 152000 && saved.avgViews === 45200 && saved.categories.includes('beauty') && saved.analysis && saved.analysis.hashtags.includes('reviewskincare'), 'Profile grab saved to Kho KOC', JSON.stringify(saved));
    await p1.close();

    // Video with Vietnamese subtitles + AI
    await tool.evaluate(() => localStorage.setItem('gemini_api_key_v2', 'test_key'));
    let p2 = await runBookmarklet('https://www.tiktok.com/@demo_koc/video/123');
    await p2.waitForFunction(() => currentGrab && currentGrab.aiState === 'done', null, { timeout: 5000 });
    body = await p2.textContent('#grab-body');
    check(body.includes('đã có trong Kho KOC') && body.includes('Kênh review skincare uy tín') && body.includes('88/100') && body.includes('Brand Y'), 'Video grab: existing KOC detected, AI analysis shown', body.slice(0, 400));
    check(geminiPrompt.includes('Hôm nay mình test serum vitamin C') && !geminiPrompt.includes('English line'), 'Video grab: Vietnamese subtitle preferred and sent to AI');
    await p2.click('#btn-grab-save');
    saved = await p2.evaluate(() => kocs.filter(k => k.link === 'https://www.tiktok.com/@demo_koc'));
    check(saved.length === 1 && saved[0].er === 10 && saved[0].gender === 'nu' && saved[0].analysis.transcripts.length === 1 && saved[0].analysis.ai.fitScore === 88 && saved[0].avgViews === 45200,
      'Video grab merged into same KOC (ER from video, AI fields, transcript kept, avg views kept)', JSON.stringify(saved[0] || {}).slice(0, 300));
    await p2.close();

    // Stale SPA data
    await tool.evaluate(() => localStorage.removeItem('gemini_api_key_v2'));
    let p3 = await runBookmarklet('https://www.tiktok.com/@demo_koc/video/999');
    body = await p3.textContent('#grab-body');
    check(body.includes('F5') && !(await p3.evaluate(() => currentGrab.summary.transcript)), 'Stale TikTok data detected, no wrong subtitle used');
    await p3.close();

    // Search suggestions
    await tool.reload();
    await tool.waitForFunction(() => typeof suggestSearchTerms === 'function');
    await tool.click('text=⚡ Tạo từ khóa');
    const links = await tool.$$eval('#search-suggestions a', (as) => as.map(a => a.href));
    check(links.some(h => h.startsWith('https://www.tiktok.com/search/user?q=')) && links.some(h => h.startsWith('https://www.tiktok.com/tag/')), 'Search suggestions link to TikTok', links.slice(0, 3).join(' '));

    check(!errors.length, 'No page errors (bookmarklet)', errors.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nAll browser tests passed');
  process.exit(failures ? 1 : 0);
})();
