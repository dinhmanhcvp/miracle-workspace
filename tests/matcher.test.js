// Unit tests for the KOC matcher: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../assets/matcher.js');

const koc = (o) => M.normalizeKoc({ platform: 'TikTok', followers: 200000, avgViews: 80000, er: 6, rate: 8000000, taxType: 'VAT', rating: 4, ...o });
const pricing = { mode: 'margin', pct: 20 };

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
  const ctx = { pricing, isBlacklisted: (n) => n === 'Bad Guy' };
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
