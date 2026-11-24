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
    await page.evaluate(() => { localStorage.setItem('miracle_blacklist_custom', JSON.stringify(['Old Name Only'])); localStorage.removeItem('miracle_blacklist_v2'); });
    await page.reload();
    await page.waitForFunction(() => typeof window.runAutomatedTests === 'function');
    const migrated = await page.evaluate(() => getBlacklistEntries().map(e => e.name));
    check(migrated.join() === 'Old Name Only', 'Old name-only blacklist converted to the new format', JSON.stringify(migrated));
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
    await page.click('text=Nhập từ Excel / Sheets / CSV');
    const tsv = 'Tên\tNền tảng\tFollowers\tView TB\tER (%)\tNgành\tGiới tính khán giả\tĐộ tuổi khán giả\tKhu vực\tGiá nhập\n' +
      'Paste KOC One\tTikTok\t150k\t60k\t7\tMỹ phẩm\tNữ\t18-24\tTP.HCM\t6tr\n' +
      '<img src=x onerror=window.__xss=1>\tTikTok\t20k\t5k\t3\tGame\tNam\t13-17\tHà Nội\t2tr\n';
    await page.fill('#paste-text', tsv);
    await page.click('#btn-import-confirm');
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
    check(msg.includes('ABC Media') && !msg.includes('agency bên mình'), 'Fallback message uses agency name', msg.slice(0, 120));

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

  // ---------- 4. Team sync through Google Sheets (Apps Script running on a fake Sheet) ----------
  {
    const fs = require('fs');
    const { createBackend } = require('./fake-apps-script');
    const root = path.resolve(__dirname, '..');
    const backend = createBackend({ token: 'team-secret' });
    const SYNC_URL = 'https://script.google.com/macros/s/TESTDEPLOY/exec';
    const errors = [];
    const serveTool = async (ctx) => {
      await ctx.route('https://tool.test/**', (route) => {
        const p = new URL(route.request().url()).pathname.replace(/^\//, '') || 'index.html';
        const file = path.join(root, p);
        if (!file.startsWith(root) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
        route.fulfill({ body: fs.readFileSync(file), contentType: p.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' });
      });
      await ctx.route(SYNC_URL + '**', (route) => {
        const req = route.request();
        route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: backend.http(req.method(), req.url(), req.postData()) });
      });
    };
    const openMember = async (name) => {
      const ctx = await browser.newContext();
      await serveTool(ctx);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
      page.on('dialog', (d) => d.accept());
      await page.goto('https://tool.test/index.html');
      await page.waitForFunction(() => window.Sync && typeof upsertKocs === 'function');
      return { ctx, page };
    };
    const connect = async (page, user, token = 'team-secret') => {
      await page.evaluate(({ url, token, user }) => {
        openModal('settings');
        document.getElementById('sync-url').value = url;
        document.getElementById('sync-token').value = token;
        document.getElementById('sync-user').value = user;
        saveSettings();
      }, { url: SYNC_URL, token, user });
    };
    const waitSynced = (page) => page.waitForFunction(() => /Đã đồng bộ|Lỗi/.test(document.getElementById('sync-status-text').textContent) && !/Đang/.test(document.getElementById('sync-status-text').textContent), null, { timeout: 8000 });
    const syncNow = (page) => page.evaluate(() => Sync.syncNow());

    // A has local data before connecting
    const A = await openMember('A');
    await A.page.evaluate(() => {
      upsertKocs([KocMatcher.normalizeKoc({ name: 'Sync KOC One', platform: 'TikTok', link: 'https://www.tiktok.com/@sync_one', contact: '0900000001', followers: 120000, categories: ['beauty'], ages: ['18-24'], rate: 5000000 }),
                  KocMatcher.normalizeKoc({ name: 'Sync KOC Two', platform: 'FB', followers: 50000, rate: 3000000 })]);
      loadDemoKocs(); // demo data must never be uploaded
      setBlacklistEntries([...getBlacklistEntries(), KocMatcher.normalizeBlacklistEntry({ name: 'Sync Bad', link: 'https://www.tiktok.com/@sync_bad', reason: 'test' })]);
      document.getElementById('pnl-name').value = 'Sync KOC One'; document.getElementById('pnl-cost').value = '5000000'; document.getElementById('pnl-kpi').value = '10000';
      refreshCalculations(); savePnlToDb();
    });
    check(await A.page.textContent('#sync-status-text') === 'Dữ liệu chỉ lưu trên trình duyệt này', 'Not connected: local-only status shown');
    await connect(A.page, 'An');
    await waitSynced(A.page);
    let kocRows = backend.rowsOf('Kho KOC');
    check(kocRows.length === 2 && kocRows.every(r => !/\[Mẫu\]/.test(r['Tên'])), 'First connect uploads local KOCs (not demo data)', kocRows.map(r => r['Tên']).join(', '));
    check(kocRows[0]['Contact'] === '0900000001' && kocRows[0]['Độ tuổi khán giả'] === '18–24' && kocRows[0].updatedBy === 'An', 'Sheet columns are readable (contact text, age range, editor)', JSON.stringify(kocRows[0]));
    check(backend.rowsOf('Blacklist').length === 1 && backend.rowsOf('Kho PNL').length === 1 && backend.rowsOf('Kho PNL')[0]['Thành tiền (D)'] > 0, 'Blacklist and PNL uploaded');

    // B joins and receives everything
    const B = await openMember('B');
    await connect(B.page, 'Bình');
    await waitSynced(B.page);
    let bState = await B.page.evaluate(() => ({ kocs: kocs.map(k => k.name).sort(), bl: getBlacklistEntries().map(e => e.name), pnl: savedPNL.length, cats: kocs.find(k => k.name === 'Sync KOC One').categories, ages: kocs.find(k => k.name === 'Sync KOC One').ages }));
    check(bState.kocs.join() === 'Sync KOC One,Sync KOC Two' && bState.bl.join() === 'Sync Bad' && bState.pnl === 1, 'Second member receives KOCs, blacklist, PNL', JSON.stringify(bState));
    check(bState.cats.join() === 'beauty' && bState.ages.join() === '18-24', 'Categories and ages survive the round trip', JSON.stringify(bState));

    // B edits, A receives
    await B.page.evaluate(() => { const k = kocs.find(x => x.name === 'Sync KOC Two'); k.rate = 3500000; persistKocs(); });
    await syncNow(B.page);
    await syncNow(A.page);
    check(await A.page.evaluate(() => kocs.find(x => x.name === 'Sync KOC Two').rate) === 3500000, 'Edit by B reaches A');

    // A deletes, B loses it
    await A.page.evaluate(() => { kocs = kocs.filter(x => x.name !== 'Sync KOC Two'); persistKocs(); });
    await syncNow(A.page);
    await syncNow(B.page);
    check(!(await B.page.evaluate(() => kocs.some(x => x.name === 'Sync KOC Two'))), 'Deletion by A reaches B');
    check(backend.rowsOf('Kho KOC').find(r => r['Tên'] === 'Sync KOC Two').deleted === true, 'Deleted row flagged in Sheet (not erased)');

    // Someone edits / adds rows directly in the Sheet
    const rowIdx = backend.sheets['Kho KOC'].data.findIndex(r => r[1] === 'Sync KOC One') + 1;
    backend.userEdit('Kho KOC', rowIdx, 'Giá nhập', 6200000);
    backend.userAppendRow('Kho KOC', { 'Tên': 'Typed In Sheet', 'Nền tảng': 'TikTok', 'Nhóm / Ngành': 'Ẩm thực / F&B', 'Giá nhập': 2000000 });
    await syncNow(B.page);
    bState = await B.page.evaluate(() => ({ rate: kocs.find(x => x.name === 'Sync KOC One').rate, typed: kocs.find(x => x.name === 'Typed In Sheet') }));
    check(bState.rate === 6200000, 'Cell edited in the Sheet reaches the tool', bState.rate);
    check(bState.typed && bState.typed.categories.join() === 'fnb' && bState.typed.platform === 'TikTok', 'Row typed in the Sheet becomes a KOC', JSON.stringify(bState.typed));

    // Conflict: A edits after B; newest wins everywhere
    await B.page.evaluate(() => { kocs.find(x => x.name === 'Sync KOC One').notes = 'note from B'; persistKocs(); });
    await A.page.waitForTimeout(20);
    await A.page.evaluate(() => { kocs.find(x => x.name === 'Sync KOC One').notes = 'note from A'; persistKocs(); });
    await syncNow(B.page); await syncNow(A.page); await syncNow(B.page);
    const notes = await Promise.all([A.page, B.page].map(p => p.evaluate(() => kocs.find(x => x.name === 'Sync KOC One').notes)));
    check(notes[0] === 'note from A' && notes[1] === 'note from A', 'Concurrent edits: newest wins on both sides', JSON.stringify(notes));

    // Reload keeps sync state, in-app tests never upload test data
    await A.page.reload();
    await A.page.waitForFunction(() => window.Sync && typeof upsertKocs === 'function');
    await waitSynced(A.page);
    const before = JSON.stringify(backend.sheets);
    await A.page.evaluate(() => runAutomatedTests({ silent: true }));
    await syncNow(A.page);
    check(JSON.stringify(backend.sheets) === before, 'In-app test suite does not touch the team Sheet');

    // Wrong token is reported
    const C = await openMember('C');
    await connect(C.page, 'Chi', 'wrong-token');
    await waitSynced(C.page);
    check(/Sai mã bí mật/.test(await C.page.textContent('#sync-status-text')), 'Wrong token shows a clear error');

    check(!errors.length, 'No page errors (sync)', errors.join(' | '));
    await Promise.all([A.ctx.close(), B.ctx.close(), C.ctx.close()]);
  }

  // ---------- 5. Import an .xlsx workbook laid out like the agency files (fictional data) ----------
  {
    let XLSX = null, xlsxSrc = null;
    try { XLSX = require('xlsx'); xlsxSrc = require.resolve('xlsx/dist/xlsx.full.min.js'); } catch (e) { console.log('SKIP  .xlsx import test (npm package "xlsx" not installed)'); }
    if (XLSX) {
      const fs = require('fs');
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['QUY TRÌNH', 'Nội dung'], ['Nhận brief', 'abc']]), 'ASSIGN SCOPE');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Workfile INT demo'], [],
        ['STT', 'KOLs', 'Link', 'Followers', 'Contact', 'Check', 'Hạng Mục Công Việc', 'Chi phí', 'Số lượng', 'Đơn vị', 'Thành tiền', 'Internal Cost TM', '', '', 'Thuế booking', '', '', '', 'Margin  35%', 'Thuế', 'Payment  Term'],
        ['', '', '', '', '', '', '', '', '', '', '', 'Cost Booking', 'Số lượng booking', 'Total Booking', '', 'Phí giới thiệu', 'Thuế phí giới thiệu', 'Lợi nhuận gộp', '', '', ''],
        ['A. BOOKING ON TIKTOK'],
        [1, 'Xlsx Creator One', 'https://www.tiktok.com/@xlsx_one', 25000, '0900000003', false, '01 video review', 5000000, 1, 'Video', 5000000, 2000000, 1, 2000000, 222222, 250000, 27778, 2500000, 0.5, 'PIT', '100% sau'],
        [2, 'Xlsx Creator Two', 'https://www.tiktok.com/@xlsx_two', 300000, 'demo@example.com', false, '01 video review', 12000000, 1, 'Video', 12000000, 7000000, 1, 7000000, 0, 600000, 66667, 4333333, 0.36, 'VAT', '50-50'],
        ['B. HỌC SINH SINH VIÊN'],
        [1, 'Xlsx Student', 'https://www.tiktok.com/@xlsx_student', 40000, '', false, '01 video', 4000000, 1, 'Video', 4000000, 2200000],
      ]), 'NB LIST');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['N.o', 'Dự án', 'Name', 'Link kênh', 'Note'], [1, 'Demo', 'Xlsx Bad', 'https://www.tiktok.com/@xlsx_bad', 'Không hợp tác'], [2]]), 'BLACKLIST');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('dialog', (d) => d.accept());
      await ctx.route('**/xlsx.full.min.js', (route) => route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(xlsxSrc) }));
      await page.goto(url);
      await page.waitForFunction(() => typeof openImportModal === 'function');
      await page.evaluate(() => openImportModal('koc'));
      await page.setInputFiles('#import-file-xlsx', { name: 'Workfile-demo.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
      await page.waitForFunction(() => /Đọc được/.test(document.getElementById('paste-preview').textContent), null, { timeout: 8000 });
      const picked = await page.inputValue('#import-sheet');
      check(picked === 'NB LIST', 'Best sheet auto-selected in a multi-sheet workbook', picked);
      const preview = await page.textContent('#paste-preview');
      check(/Đọc được 3 KOC/.test(preview), 'Workbook rows detected (sections and 2-level header handled)', preview);
      await page.click('#btn-import-confirm');
      let st = await page.evaluate(() => kocs.map(k => ({ n: k.name, rate: k.rate, q: k.lastQuote, tax: k.taxType, pay: k.paymentTerm, cats: k.categories, plat: k.platform })));
      const one = st.find(k => k.n === 'Xlsx Creator One');
      check(st.length === 3 && one.rate === 2000000 && one.q === 5000000 && one.plat === 'TikTok' && one.pay === '100% sau', 'xlsx import: cost vs price columns, platform from section', JSON.stringify(one));
      check(st.find(k => k.n === 'Xlsx Student').cats.includes('student'), 'xlsx import: persona section → group', JSON.stringify(st));

      await page.evaluate(() => openImportModal('blacklist'));
      await page.setInputFiles('#import-file-xlsx', { name: 'Quy-chuan-demo.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
      await page.waitForFunction(() => /Đọc được/.test(document.getElementById('paste-preview').textContent), null, { timeout: 8000 });
      check(await page.inputValue('#import-sheet') === 'BLACKLIST', 'Blacklist target picks the BLACKLIST sheet');
      await page.click('#btn-import-confirm');
      const bl = await page.evaluate(() => ({ list: getBlacklistEntries().map(e => [e.name, e.project, e.reason]), hit: !!findBlacklisted('Renamed', 'https://www.tiktok.com/@xlsx_bad') }));
      check(bl.list.length === 1 && bl.list[0].join('|') === 'Xlsx Bad|Demo|Không hợp tác' && bl.hit, 'Blacklist imported with project/reason, matched by link', JSON.stringify(bl));

      // Manual column override
      await page.evaluate(() => openImportModal('koc'));
      await page.fill('#paste-text', 'Tên\tGiá\nManual Map\t7000000');
      await page.waitForTimeout(400);
      await page.selectOption('#import-mapping select[data-col="1"]', 'rate');
      await page.click('#btn-import-confirm');
      check(await page.evaluate(() => kocs.find(k => k.name === 'Manual Map').rate) === 7000000, 'Column mapping can be corrected by hand');
      check(!errors.length, 'No page errors (xlsx)', errors.join(' | '));
      await ctx.close();
    }
  }

  // ---------- 6. Agency configuration and licensing ----------
  {
    const fs = require('fs');
    const crypto = require('crypto');
    const root = path.resolve(__dirname, '..');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const jwk = publicKey.export({ format: 'jwk' });
    const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const issue = (payload) => { const d = Buffer.from(JSON.stringify({ v: 1, id: 'test', ...payload })); return `${b64url(d)}.${b64url(crypto.sign('sha256', d, { key: privateKey, dsaEncoding: 'ieee-p1363' }))}`; };
    const errors = [];
    const open = async ({ licensing }) => {
      const ctx = await browser.newContext();
      await ctx.route('https://tool.test/**', (route) => {
        const p = new URL(route.request().url()).pathname.replace(/^\//, '') || 'index.html';
        if (licensing && p === 'assets/license-key.js') return route.fulfill({ contentType: 'text/javascript', body: `window.LICENSE_PUBLIC_KEY = ${JSON.stringify(jwk)}; window.LICENSE_VENDOR = { name: 'Vendor Demo', contact: 'vendor@example.com' };` });
        const file = path.join(root, p);
        if (!file.startsWith(root) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
        route.fulfill({ body: fs.readFileSync(file), contentType: p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8' });
      });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('dialog', (d) => d.accept());
      await page.goto('https://tool.test/index.html');
      await page.waitForFunction(() => window.License && typeof renderConfigTab === 'function');
      await page.waitForTimeout(300);
      return { ctx, page };
    };

    // Config (licensing off)
    const { ctx: c1, page } = await open({ licensing: false });
    check(await page.isHidden('#license-banner') && await page.isHidden('#license-lock'), 'Licensing disabled by default: no banner, no lock');
    await page.click('#btn-tab-config');
    await page.fill('#cfg-agency', 'Config Agency');
    await page.fill('#cfg-fmt-prepnl', 'stt, name, D, L');
    await page.fill('#cfg-fmt-label-prepnl', 'PNL ngắn');
    await page.fill('#cfg-fmt-quotation', 'stt, name, D, X');
    await page.fill('#cfg-tax-PIT', '10');
    await page.fill('#cfg-focs', 'FOC một\nFOC hai');
    await page.click('text=Lưu cấu hình >> nth=0');
    check(await page.evaluate(() => getAgencyConfig().formats.quotation.columns.includes('X')) === false, 'Quotation format with internal cost is refused');
    await page.fill('#cfg-fmt-quotation', 'stt, name, D');
    await page.click('text=Lưu cấu hình >> nth=0');
    const cfg = await page.evaluate(() => getAgencyConfig());
    check(cfg.agencyName === 'Config Agency' && cfg.tax.PIT === 10 && cfg.formats.prepnl.columns.join() === 'stt,name,D,L' && cfg.focs.length === 2, 'Agency config saved', JSON.stringify({ n: cfg.agencyName, t: cfg.tax, f: cfg.formats.prepnl }));
    const out = await page.evaluate(() => {
      window.__clip = ''; copyTextToClipboard = async (t) => { window.__clip = t; };
      $('pnl-name').value = 'Cfg KOL'; $('pnl-cost').value = '1000000'; $('pnl-tax-type').value = 'PIT'; $('pnl-kpi').value = '1000';
      const d = refreshCalculations(); savePnlToDb(); copyBulkPnl('prepnl');
      return { F: d.F, clip: window.__clip, label: document.querySelector('[data-format-label="prepnl"]').textContent, focs: [...document.querySelectorAll('#foc-container input')].map(i => i.value), title: $('brand-title').textContent };
    });
    check(Math.round(out.F) === 100000, 'Custom PIT rate used in PNL', out.F);
    check(out.clip.split('\t').length === 4 && out.clip.startsWith('1\tCfg KOL\t'), 'Custom copy format used', out.clip);
    check(out.label === 'PNL ngắn' && out.focs.join('|') === 'FOC một|FOC hai' && out.title === 'Config Agency', 'Format label, FOC list and agency name applied in UI', JSON.stringify(out));
    const suite = await page.evaluate(() => runAutomatedTests({ silent: true }));
    check(suite.failed === 0, 'In-app tests still pass with a customised agency config', JSON.stringify(suite.results.filter(r => !r.pass)));
    check(await page.evaluate(() => getAgencyConfig().tax.PIT) === 10, 'In-app tests restore the agency config');
    await c1.close();

    // Licensing on
    const { ctx: c2, page: p2 } = await open({ licensing: true });
    check(/Bản dùng thử: còn 14 ngày/.test(await p2.textContent('#license-banner')) && await p2.isHidden('#license-lock'), 'Trial banner shown on first use');
    await p2.evaluate(() => localStorage.setItem('miracle_trial_start', new Date(Date.now() - 20 * 86400000).toISOString()));
    await p2.reload();
    await p2.waitForFunction(() => window.License);
    await p2.waitForSelector('#license-lock.flex', { timeout: 5000 });
    check(/dùng thử đã kết thúc/.test(await p2.textContent('#license-lock-reason')) && /vendor@example.com/.test(await p2.textContent('#license-lock-contact')), 'Expired trial locks the tool and shows vendor contact');
    const good = issue({ agency: 'Licensed Agency', plan: 'Pro', exp: new Date(Date.now() + 10 * 86400000).toISOString(), domains: ['tool.test'] });
    const forged = good.split('.')[0].replace(/.$/, c => (c === 'A' ? 'B' : 'A')) + '.' + good.split('.')[1];
    await p2.fill('#license-lock-key', forged);
    await p2.click('#license-lock >> text=Kích hoạt');
    await p2.waitForTimeout(300);
    check(await p2.isVisible('#license-lock') && /không hợp lệ/.test(await p2.textContent('#license-lock-reason')), 'Tampered license rejected');
    await p2.fill('#license-lock-key', good);
    await p2.click('#license-lock >> text=Kích hoạt');
    await p2.waitForSelector('#license-lock.hidden', { state: 'attached', timeout: 5000 });
    const lic = await p2.evaluate(() => ({ s: License.status(), name: getAgencyConfig().agencyName }));
    check(lic.s.valid && lic.name === 'Licensed Agency' && /hết hạn sau 10 ngày/.test(await p2.textContent('#license-banner')), 'Valid license unlocks, sets agency name, warns before expiry', JSON.stringify(lic));
    for (const [payload, reason, name] of [
      [{ agency: 'X', exp: new Date(Date.now() - 86400000).toISOString() }, /hết hạn/, 'Expired license locks'],
      [{ agency: 'X', exp: new Date(Date.now() + 86400000 * 400).toISOString(), domains: ['other-agency.com'] }, /không dùng cho địa chỉ/, 'License bound to another domain is refused'],
    ]) {
      await p2.evaluate((k) => License.activate(k), issue(payload));
      await p2.waitForTimeout(200);
      check(await p2.isVisible('#license-lock') && reason.test(await p2.textContent('#license-lock-reason')), name, await p2.textContent('#license-lock-reason'));
    }
    check(!errors.length, 'No page errors (config/license)', errors.join(' | '));
    await c2.close();
  }

  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nAll browser tests passed');
  process.exit(failures ? 1 : 0);
})();
