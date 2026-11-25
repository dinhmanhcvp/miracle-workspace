// Unit tests for the KOC matcher: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../assets/matcher.js');

const koc = (o) => M.normalizeKoc({ platform: 'TikTok', followers: 200000, avgViews: 80000, er: 6, rate: 8000000, taxType: 'VAT', rating: 4, ...o });
const pricing = { mode: 'margin', pct: 20, discountPct: 0, cbPct: 0, roundTo: 0 };

test('parseNumber handles Vietnamese shorthands', () => {
  assert.equal(M.parseNumber('10.000.000'), 10000000);
  assert.equal(M.parseNumber('1,2M'), 1200000);
  assert.equal(M.parseNumber('300tr'), 300000000);
  assert.equal(M.parseNumber('1 tỷ'), 1e9);
  assert.ok(Number.isNaN(M.parseNumber('abc')));
});

test('detectCategories uses word boundaries', () => {
  assert.deepEqual(M.detectCategories('Ra mắt serum dưỡng da mới'), ['beauty']);
  assert.deepEqual(M.detectCategories('so happy today'), []);
  assert.ok(M.detectCategories('quảng bá tải app ví điện tử').includes('app'));
  assert.ok(M.detectCategories('review quán trà sữa').includes('fnb'));
});

test('pricing: margin and markup', () => {
  assert.equal(M.priceFromCost(10000000, 'margin', 20), 12500000);
  assert.equal(M.priceFromCost(10000000, 'markup', 20), 12000000);
  assert.equal(M.calcTax(9000000, 'PIT'), 1000000);
  assert.equal(M.estimatePrice({ rate: 8000000, taxType: 'VAT' }, pricing), 10000000);
});

test('parseBriefText extracts structured brief', () => {
  const b = M.parseBriefText(`Brand: Glow Lab
Sản phẩm: serum vitamin C
Mục tiêu: booking 5 KOC TikTok review skincare, target nữ 18-30 tuổi tại TP.HCM và Hà Nội.
Ngân sách: 150 triệu. Ưu tiên micro, ER tối thiểu 4%. Mỗi KOC 1 video 60s.`);
  assert.equal(b.brand, 'Glow Lab');
  assert.deepEqual(b.categories, ['beauty']);
  assert.deepEqual(b.platforms, ['TikTok']);
  assert.equal(b.gender, 'nu');
  assert.deepEqual(b.ages, ['18-24', '25-34']);
  assert.deepEqual(b.locations.sort(), ['Hà Nội', 'TP.HCM']);
  assert.equal(b.totalBudget, 150000000);
  assert.equal(b.kocCount, 5);
  assert.deepEqual(b.tiers, ['micro']);
  assert.equal(b.minER, 4);
  assert.match(b.deliverable, /1 video 60s/);
});

test('parseBriefText does not treat "Việt Nam"/"miền Nam" as male target', () => {
  const b = M.parseBriefText('Chiến dịch toàn quốc Việt Nam, ưu tiên miền Nam, khách hàng nữ');
  assert.equal(b.gender, 'nu');
});

test('scoreKoc rewards matching KOC over mismatching one', () => {
  const brief = { categories: ['beauty'], platforms: ['TikTok'], gender: 'nu', ages: ['18-24'], locations: ['TP.HCM'], totalBudget: 50000000, kocCount: 4, tiers: ['mid'] };
  const good = M.scoreKoc(koc({ name: 'A', categories: ['beauty'], gender: 'nu', ages: ['18-24'], location: 'TP.HCM' }), brief, { pricing });
  const bad = M.scoreKoc(koc({ name: 'B', categories: ['game'], gender: 'nam', ages: ['25-34'], location: 'Hà Nội', rate: 20000000 }), brief, { pricing });
  assert.equal(good.excluded, null);
  assert.ok(good.score >= 85, `good score ${good.score}`);
  assert.ok(bad.score < 45, `bad score ${bad.score}`);
  assert.ok(good.reasons.some(r => r.type === 'good' && /Đúng ngành/.test(r.text)));
  assert.ok(bad.reasons.some(r => r.type === 'bad' && /Khác ngành/.test(r.text)));
});

test('hard filters: blacklist, platform, over total budget', () => {
  const brief = { platforms: ['TikTok'], totalBudget: 9000000 };
  const ctx = { pricing, isBlacklisted: (k) => k.name === 'Bad Guy' };
  assert.match(M.scoreKoc(koc({ name: 'Bad Guy' }), brief, ctx).excluded, /blacklist/);
  assert.match(M.scoreKoc(koc({ name: 'X', platform: 'YT' }), brief, ctx).excluded, /Nền tảng/);
  assert.match(M.scoreKoc(koc({ name: 'Y' }), brief, ctx).excluded, /ngân sách/);
});

test('rankKocs + pickShortlist respect budget, count and duplicates', () => {
  const kocs = [
    koc({ name: 'A', categories: ['beauty'], rate: 8000000 }),     // price 10M
    koc({ name: 'A', platform: 'FB', categories: ['beauty'], rate: 8000000 }),
    koc({ name: 'B', categories: ['beauty'], rate: 16000000 }),    // price 20M
    koc({ name: 'C', categories: ['beauty'], rate: 4000000 }),     // price 5M
    koc({ name: 'D', categories: ['fnb'], rate: 4000000 }),
  ];
  const brief = { categories: ['beauty'], totalBudget: 25000000, kocCount: 3 };
  const { matches } = M.rankKocs(kocs, brief, { pricing });
  assert.equal(matches.length, 5);
  assert.equal(matches[matches.length - 1].koc.name, 'D');
  const { picked, total } = M.pickShortlist(matches, brief);
  assert.ok(total <= 25000000, `total ${total}`);
  assert.equal(new Set(picked.map(p => p.koc.name)).size, picked.length, 'no duplicate person');
  assert.ok(picked.length <= 3);
  assert.ok(!picked.some(p => p.koc.name === 'D'), 'low score not picked');
});

test('importKocsFromText maps Vietnamese headers from Excel paste', () => {
  const tsv = 'Tên\tNền tảng\tLink\tFollowers\tView TB\tER (%)\tNgành\tGiới tính\tĐộ tuổi\tKhu vực\tGiá nhập\tCột lạ\n' +
    'Linh Beauty\ttiktok\thttps://tiktok.com/@linh\t120k\t45k\t7,5\tMỹ phẩm, Thời trang\tNữ\t18-24; 25-34\tSài Gòn\t8tr\tx\n' +
    '\t\t\t\t\t\t\t\t\t\t\t\n';
  const r = M.importKocsFromText(tsv);
  assert.equal(r.kocs.length, 1);
  const k = r.kocs[0];
  assert.equal(k.platform, 'TikTok');
  assert.equal(k.followers, 120000);
  assert.equal(k.avgViews, 45000);
  assert.equal(k.er, 7.5);
  assert.deepEqual(k.categories, ['beauty', 'fashion']);
  assert.equal(k.gender, 'nu');
  assert.deepEqual(k.ages, ['18-24', '25-34']);
  assert.equal(k.location, 'TP.HCM');
  assert.equal(k.rate, 8000000);
  assert.deepEqual(r.unknownHeaders, ['Cột lạ']);
});

test('CSV export round-trips through import', () => {
  const src = [koc({ name: 'Quote "Test", Inc', categories: ['beauty', 'fnb'], notes: 'dòng 1\ndòng 2', gender: 'nu', ages: ['18-24'], location: 'Hà Nội' })];
  const back = M.importKocsFromText(M.exportKocsToCsv(src)).kocs[0];
  assert.equal(back.name, 'Quote "Test", Inc');
  assert.deepEqual(back.categories, ['beauty', 'fnb']);
  assert.equal(back.notes, 'dòng 1\ndòng 2');
  assert.equal(back.gender, 'nu');
  assert.equal(back.rate, 8000000);
});

test('parseSubtitles strips WebVTT timing and duplicates', () => {
  const vtt = 'WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.000\nXin chào cả nhà\n\n2\n00:00:02.000 --> 00:00:04.000\n<c>Xin chào cả nhà</c>\n\n00:00:04.000 --> 00:00:06.000\nHôm nay mình review serum';
  assert.equal(M.parseSubtitles(vtt), 'Xin chào cả nhà Hôm nay mình review serum');
});

test('parseNumber reads TikTok/Vietnamese counters', () => {
  assert.equal(M.parseNumber('45.2K'), 45200);
  assert.equal(M.parseNumber('1,5 N'), 1500);
  assert.equal(M.parseNumber('2.1M'), 2100000);
});

test('summarizeGrab: profile page', () => {
  const s = M.summarizeGrab({
    v: 1, source: 'tiktok', type: 'profile', handle: 'demo', name: 'Demo', bio: 'Review skincare Sài Gòn',
    followers: 150000, likes: 3000000, videoCount: 200,
    videos: [
      { desc: 'Review serum vitamin C #reviewskincare #fyp created by Demo with sound', viewsText: '40K' },
      { desc: 'Kem chống nắng cho da dầu #skincare', viewsText: '60K' },
      { desc: 'Mã giảm giá ở giỏ hàng nha #quangcao #skincare', viewsText: '50K' },
      { desc: 'Video ghim', viewsText: '5M', pinned: true },
    ],
  });
  assert.equal(s.avgViews, 50000, 'median without pinned');
  assert.equal(s.link, 'https://www.tiktok.com/@demo');
  assert.equal(s.platform, 'TikTok');
  assert.deepEqual(s.categories, ['beauty']);
  assert.deepEqual(s.locations, ['TP.HCM']);
  assert.equal(s.hashtags[0], 'skincare');
  assert.ok(!s.hashtags.includes('fyp'));
  assert.equal(s.sponsoredCount, 1);
  assert.equal(s.er, 1.2); // (3M likes / 200 videos) / mean views 1.2875M
  assert.ok(!/created by/.test(s.captions[0]));
});

test('summarizeGrab: video page with transcript uses video ER', () => {
  const s = M.summarizeGrab({ v: 1, source: 'tiktok', type: 'video', url: 'https://www.tiktok.com/@demo/video/1', handle: 'demo', name: 'Demo',
    video: { desc: 'Unbox laptop gaming', views: 100000, likes: 8000, comments: 1000, shares: 1000, transcriptRaw: 'WEBVTT\n\n00:00.000 --> 00:01.000\nHôm nay mình review laptop' } });
  assert.equal(s.er, 10);
  assert.equal(s.avgViews, 100000);
  assert.equal(s.transcript, 'Hôm nay mình review laptop');
  assert.ok(s.categories.includes('tech'));
  assert.equal(s.videoUrl, 'https://www.tiktok.com/@demo/video/1');
});

test('buildSearchTerms gives Vietnamese terms and hashtags', () => {
  const r = M.buildSearchTerms({ categories: ['beauty'], locations: ['TP.HCM'], product: 'serum vitamin C' });
  assert.equal(r.terms[0], 'review serum vitamin c');
  assert.ok(r.terms.includes('review mỹ phẩm'));
  assert.ok(r.hashtags.includes('reviewmypham'));
  assert.ok(r.terms.some(t => t.includes('sài gòn')));
  assert.deepEqual(M.buildSearchTerms({}).terms, []);
});

// Formula checks mirror the PRE PNL template structure (numbers are illustrative)
test('calcPnl follows PRE PNL formulas (C, D, E, F, G, H, K, L)', () => {
  const r = (x) => Math.round(x);
  const a = M.calcPnl({ A: 3000000, B: 1, discountPct: 5, X: 1000000, O: 1, taxType: 'PIT', cbPct: 5, backup: 35000 });
  assert.deepEqual([a.C, a.D, a.E, a.F, a.G, a.H, a.M, a.K].map(r), [150000, 2850000, 1000000, 111111, 142500, 15833, 35000, 1545556]);
  assert.equal(a.L.toFixed(4), '0.5423');
  const b = M.calcPnl({ A: 2500000, B: 2, discountPct: 5, X: 1000000, O: 2, taxType: 'VAT', cbPct: 5, backup: 35000, kpiEng: 1000 });
  assert.deepEqual([b.C, b.D, b.E, b.F, b.G, b.H, b.K].map(r), [250000, 4750000, 2000000, 0, 237500, 26389, 2451111]);
  assert.equal(r(b.CPE), 4750);
  const c = M.calcPnl({ A: 1000000, B: 1, discountPct: 5, X: 500000, O: 1, taxType: 'HKD', cbPct: 5, backup: 0 });
  assert.deepEqual([c.D, c.F, c.G, c.H, c.K].map(r), [950000, 35000, 47500, 5278, 362222]);
  const d = M.calcPnl({ A: 5000000, X: 2000000, taxType: 'PIT', cbPct: 5, discountPct: 0 });
  assert.equal(r(d.K), 2500000);
  assert.equal(d.L, 0.5);
});

test('backup follows COMMIT KPI rates', () => {
  assert.equal(M.calcBackup('TikTok', 200000, 0), 700000);
  assert.equal(M.calcBackup('FB', 10000, 2000), 150000 + 70000);
  assert.equal(M.calcBackup('Threads', 0, 400), 280000);
  assert.equal(M.calcBackup('YT', 1000, 0), 35000);
  assert.equal(M.calcBackup('Instagram', 1000, 0), 15000);
});

test('solvePrice reaches the target margin after all deductions', () => {
  for (const tax of ['PIT', 'VAT', 'HKD']) {
    const A = M.solvePrice({ X: 6000000, taxType: tax, pct: 35, discountPct: 5, cbPct: 5, roundTo: 0, platform: 'TikTok', kpiView: 20000 });
    const p = M.calcPnl({ A, X: 6000000, taxType: tax, discountPct: 5, cbPct: 5, platform: 'TikTok', kpiView: 20000 });
    assert.ok(Math.abs(p.L - 0.35) < 1e-6, `${tax}: ${p.L}`); // A is rounded to whole đồng
  }
  const rounded = M.solvePrice({ X: 2000000, taxType: 'PIT', pct: 35, discountPct: 0, cbPct: 5, roundTo: 100000 });
  assert.equal(rounded % 100000, 0);
  assert.ok(M.calcPnl({ A: rounded, X: 2000000, taxType: 'PIT', cbPct: 5 }).L >= 0.35);
  assert.equal(M.solvePrice({ X: 1000000, mode: 'markup', pct: 50, discountPct: 0, cbPct: 0, roundTo: 0, taxType: 'VAT' }), 1500000);
});

// Layout mirrors an internal workfile (title rows, 2-level header, section rows, total row). All data is fictional.
test('importTable reads workfile layout: title rows, 2-level header, sections', () => {
  const rows = [
    ['Workfile INT demo'],
    [],
    ['STT', 'KOLs', 'Link', 'Followers', 'Contact', 'Check', 'Hạng Mục Công Việc', 'Chi phí', 'Số lượng', 'Đơn vị', 'Thành tiền', 'Internal Cost TM', '', '', 'Thuế booking', '', '', '', 'Margin  35%', 'Thuế', 'Payment  Term', 'Note (internal)'],
    ['', '', '', '', '', '', '', '', '', '', '', 'Cost Booking', 'Số lượng booking', 'Total Booking', '', 'Phí giới thiệu', 'Thuế phí giới thiệu', 'Lợi nhuận gộp', '', '', '', ''],
    ['A. BOOKING ON TIKTOK'],
    [1, 'Demo Creator One', 'https://www.tiktok.com/@demo_one', 1950, '0900000001', false, 'Sản xuất và đăng tải 01 video review', 5000000, 1, 'Video', 5000000, 2000000, 1, 2000000, 222222.22, 250000, 27777.78, 2500000, 0.5, 'PIT', '100% sau', ''],
    [2, 'Demo Creator Two', 'https://www.tiktok.com/@demo_two', 107200, 'demo@example.com', false, 'Sản xuất video', 17000000, 1, 'Video', 17000000, 10000000, 1, 10000000, 0, 850000, 94444, 6055555, 0.356, 'VAT', '100% sau', 'Kèm youtube short'],
    ['Tổng chi phí', '', '', '', '', '', '', '', '', '', 22000000],
    ['B. GIA ĐÌNH'],
    [1, 'Demo Family Channel', '', '70.2K', '', '', '', 9000000, 1, 'Video', 9000000, 5000000],
  ];
  const r = M.importTable(rows, { target: 'koc' });
  assert.equal(r.error, undefined);
  assert.equal(r.table.headerRow, 2);
  assert.equal(r.records.length, 3);
  const [a, b, c] = r.records;
  assert.equal(a.name, 'Demo Creator One');
  assert.equal(a.platform, 'TikTok');
  assert.equal(a.rate, 2000000, 'Cost Booking -> giá nhập');
  assert.equal(a.lastQuote, 5000000, 'Chi phí -> giá bán, not giá nhập');
  assert.equal(a.taxType, 'PIT');
  assert.equal(a.contact, '0900000001');
  assert.equal(b.taxType, 'VAT');
  assert.equal(b.notes, 'Kèm youtube short');
  assert.equal(b.paymentTerm, '100% sau');
  assert.equal(c.followers, 70200);
  assert.ok(c.categories.includes('mombaby'), 'section "GIA ĐÌNH" -> category');
});

test('importTable reads PRE PNL header layout and a blacklist sheet', () => {
  const pre = [
    ['STT', 'Tên', 'Contact', 'Link kênh', 'Followers', 'Hạng mục công việc', 'External cost', '', '', '', '', 'Internal cost', '', '', '', '', '', '', '', '', 'Loại Thuế (Y)'],
    ['', '', '', '', '', '', 'Chi phí (A)', 'Số lượng (B)', 'Đơn vị tính', 'Giảm giá (C)', 'Thành tiền (D)', 'Đơn giá  Booking (X)', 'Số lượng  booking (O)', 'Total Cost  (E)', 'Thuế Booking (F)', 'CB (G)', 'Thuế CB (H)', 'Cost Backup (M)', 'Lợi nhuận gộp (K)', 'Margin (L)', ''],
    [1, 'Demo A', '0900000002', 'https://www.tiktok.com/@demo_a', '999K', 'Video review', 3000000, 1, 'Video', 150000, 2850000, 1000000, 1, 1000000, 111111, 142500, 15833, 35000, 1545555, 0.54, 'PIT'],
  ];
  const r = M.importTable(pre);
  assert.equal(r.records.length, 1);
  assert.equal(r.records[0].rate, 1000000);
  assert.equal(r.records[0].lastQuote, 3000000);
  assert.equal(r.records[0].followers, 999000);
  assert.equal(r.records[0].taxType, 'PIT');
  const bl = M.importTable([['N.o', 'Dự án', 'Name', 'Link kênh', 'Note'], [1, 'Demo project', 'Demo Bad', 'https://www.tiktok.com/@demo_bad', 'Không hợp tác'], [2, '', '', '', ''], [3]], { target: 'blacklist' });
  assert.equal(bl.records.length, 1);
  assert.deepEqual([bl.records[0].name, bl.records[0].project, bl.records[0].reason], ['Demo Bad', 'Demo project', 'Không hợp tác']);
  assert.equal(M.handleFromLink('https://www.tiktok.com/@Demo_Bad?lang=vi'), 'tiktok:demo_bad');
});

test('rates are configurable per agency', () => {
  try {
    M.configureRates({ tax: { PIT: 10, HKD: 5 }, cbTaxPct: 10, backup: { TikTok: { view: 4, eng: 0 } } });
    const p = M.calcPnl({ A: 1000000, X: 500000, taxType: 'PIT', cbPct: 10, discountPct: 0, platform: 'TikTok', kpiView: 1000 });
    assert.equal(Math.round(p.F), 50000);
    assert.equal(Math.round(p.H), 10000);
    assert.equal(p.M, 4000);
    const A = M.solvePrice({ X: 500000, taxType: 'HKD', pct: 30, cbPct: 10, discountPct: 0, roundTo: 0 });
    assert.ok(Math.abs(M.calcPnl({ A, X: 500000, taxType: 'HKD', cbPct: 10 }).L - 0.3) < 1e-6);
    assert.equal(M.getRates().backup.FB.eng, 35, 'unspecified rates keep defaults');
  } finally {
    M.configureRates({});
  }
  assert.equal(Math.round(M.calcPnl({ A: 0, X: 900, taxType: 'PIT' }).F), 100);
});

test('brief goal is detected and favours selling KOCs for sales briefs', () => {
  assert.equal(M.parseBriefText('Cần KOC bán hàng TikTok Shop, gắn giỏ hàng').goal, 'sales');
  assert.equal(M.parseBriefText('Chiến dịch tải app ví điện tử').goal, 'app');
  const brief = { categories: ['beauty'], goal: 'sales' };
  const seller = M.scoreKoc(M.normalizeKoc({ name: 'S', categories: ['beauty'], shopRatio: 0.5 }), brief);
  const nonSeller = M.scoreKoc(M.normalizeKoc({ name: 'N', categories: ['beauty'], shopRatio: 0 }), brief);
  assert.ok(seller.score > nonSeller.score);
  assert.ok(seller.reasons.some(r => /bán hàng/.test(r.text)));
});

test('summarizeGrab counts selling videos and unavailable video pages', () => {
  const s = M.summarizeGrab({ source: 'tiktok', handle: 'x', videos: [{ desc: 'Mua ở giỏ hàng nhé', viewsText: '10K' }, { desc: 'vlog', viewsText: '5K', shop: true }, { desc: 'review', viewsText: '8K' }, { desc: 'test', viewsText: '1K' }] });
  assert.equal(s.shopCount, 2);
  assert.equal(s.shopRatio, 0.5);
  assert.equal(M.summarizeGrab({ source: 'tiktok', handle: 'x', type: 'video', video: { unavailable: true } }).unavailable, true);
});

test('summarizeSearchGrab turns a search page into deduplicated candidates', () => {
  const r = M.summarizeSearchGrab({ query: 'review skincare', creators: [
    { handle: 'demo.one', name: 'Demo One', followersText: '120.5K', videos: [{ desc: 'Review serum cho da dầu #skincare', viewsText: '45K' }, { desc: 'Kem chống nắng #reviewmypham', viewsText: '30K', shop: true }] },
    { handle: 'demo.one', name: 'dup' },
    { handle: 'bad handle!', name: 'x' },
    { handle: 'demo_two', videos: [{ desc: 'Vlog đi làm dân văn phòng', viewsText: '1.2M' }] },
  ] });
  assert.equal(r.query, 'review skincare');
  assert.equal(r.candidates.length, 2);
  const [a, b] = r.candidates;
  assert.equal(a.id, 'tt:demo.one');
  assert.equal(a.followers, 120500);
  assert.equal(a.avgViews, 37500);
  assert.ok(a.categories.includes('beauty'));
  assert.equal(a.shopRatio, 0.5);
  assert.equal(a.link, 'https://www.tiktok.com/@demo.one');
  assert.ok(b.categories.includes('office'));
});

test('buildSearchPlan mixes video, hashtag and account searches with TikTok web URLs', () => {
  const plan = M.buildSearchPlan({ categories: ['beauty', 'student'], product: 'serum vitamin C' });
  assert.ok(plan.length >= 6);
  assert.equal(plan[0].type, 'video');
  assert.equal(plan[0].url, 'https://www.tiktok.com/search/video?q=review%20serum%20vitamin%20c');
  assert.ok(plan.some(p => p.type === 'tag' && p.url.startsWith('https://www.tiktok.com/tag/')));
  assert.ok(plan.some(p => p.type === 'user' && p.url.startsWith('https://www.tiktok.com/search/user?q=')));
  assert.ok(plan.some(p => p.q === 'vlog sinh viên'), 'persona searched as lifestyle content');
  assert.equal(new Set(plan.map(p => p.key)).size, plan.length);
});
