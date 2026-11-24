/*
 * KOC Matcher: pure functions (no DOM) for parsing numbers and briefs,
 * pricing, and scoring/ranking KOCs against a brand brief.
 * Works in the browser (window.KocMatcher) and in Node (module.exports) for unit tests.
 */
(function (root, factory) {
    const lib = factory();
    if (typeof module === 'object' && module.exports) module.exports = lib;
    else root.KocMatcher = lib;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ================= REFERENCE DATA =================
    const CATEGORIES = [
        { id: 'beauty', label: 'Làm đẹp / Mỹ phẩm', kw: ['mỹ phẩm', 'skincare', 'làm đẹp', 'beauty', 'makeup', 'trang điểm', 'chăm sóc da', 'serum', 'kem chống nắng', 'nước hoa', 'son môi', 'dưỡng da', 'cosmetic'] },
        { id: 'fashion', label: 'Thời trang', kw: ['thời trang', 'fashion', 'quần áo', 'outfit', 'giày', 'túi xách', 'phụ kiện thời trang', 'ootd', 'trang phục'] },
        { id: 'fnb', label: 'Ẩm thực / F&B', kw: ['f&b', 'fnb', 'ẩm thực', 'đồ ăn', 'food', 'nhà hàng', 'quán ăn', 'đồ uống', 'trà sữa', 'cafe', 'cà phê', 'mukbang', 'nấu ăn', 'món ăn', 'review ăn', 'thực phẩm', 'snack', 'bánh kẹo', 'nước giải khát'] },
        { id: 'tech', label: 'Công nghệ', kw: ['công nghệ', 'tech', 'điện thoại', 'laptop', 'smartphone', 'gadget', 'điện tử', 'tai nghe', 'đồng hồ thông minh'] },
        { id: 'game', label: 'Game', kw: ['game', 'gaming', 'esport', 'liên quân', 'pubg', 'free fire', 'gamer', 'streamer', 'mobile game'] },
        { id: 'app', label: 'App / Tài chính', kw: ['ứng dụng', 'fintech', 'ví điện tử', 'momo', 'ngân hàng', 'tài chính', 'đầu tư', 'chứng khoán', 'bảo hiểm', 'tải app', 'cài app', 'app'] },
        { id: 'mombaby', label: 'Mẹ bỉm / Gia đình', kw: ['mẹ và bé', 'mẹ & bé', 'mẹ bỉm', 'em bé', 'trẻ em', 'sữa bột', 'bỉm', 'nuôi con', 'mẹ bầu', 'trẻ nhỏ', 'gia đình', 'family', 'nội trợ', 'vợ chồng', 'cô vợ'] },
        { id: 'health', label: 'Sức khỏe / Thể thao', kw: ['sức khỏe', 'fitness', 'gym', 'thể thao', 'tập luyện', 'giảm cân', 'dinh dưỡng', 'thực phẩm chức năng', 'yoga', 'chạy bộ'] },
        { id: 'travel', label: 'Du lịch', kw: ['du lịch', 'travel', 'khách sạn', 'resort', 'homestay', 'vé máy bay', 'check-in', 'phượt'] },
        { id: 'home', label: 'Nhà cửa / Đời sống', kw: ['nhà cửa', 'gia dụng', 'nội thất', 'decor', 'nhà bếp', 'lifestyle', 'đời sống', 'dọn nhà', 'đồ dùng gia đình'] },
        { id: 'education', label: 'Giáo dục', kw: ['giáo dục', 'tiếng anh', 'khóa học', 'education', 'du học', 'ielts', 'học online', 'kỹ năng'] },
        { id: 'entertainment', label: 'Giải trí / Hài', kw: ['giải trí', 'hài', 'comedy', 'vlog', 'trend', 'âm nhạc', 'ca hát', 'dance', 'nhảy', 'kể chuyện'] },
        { id: 'auto', label: 'Xe cộ', kw: ['ô tô', 'oto', 'xe máy', 'xe điện', 'motor', 'xe hơi'] },
        { id: 'pet', label: 'Thú cưng', kw: ['thú cưng', 'pet', 'chó mèo', 'boss', 'con mèo', 'con chó'] },
        // Audience / persona groups (as used in agency briefs: "Type of channel")
        { id: 'student', label: 'Học sinh sinh viên / Gen Z', kw: ['học sinh', 'sinh viên', 'hssv', 'gen z', 'genz', 'tân sinh viên', 'đại học', 'youngster'] },
        { id: 'office', label: 'Nhân viên văn phòng', kw: ['nhân viên văn phòng', 'dân văn phòng', 'công sở', 'người đi làm', 'office'] },
        { id: 'worker', label: 'Người lao động', kw: ['lao động phổ thông', 'người lao động', 'công nhân', 'lao động sớm', 'shipper', 'tài xế'] },
        { id: 'couple', label: 'Couple / Tình yêu', kw: ['couple', 'cặp đôi', 'người yêu', 'hẹn hò', 'độc thân', 'tình yêu'] },
        { id: 'lifestyle', label: 'Lifestyle / Daily vlog', kw: ['lifestyle', 'daily vlog', 'vlog', 'cuộc sống', 'mua sắm', 'shopping', 'self care', 'chăm sóc bản thân'] },
        { id: 'expert', label: 'Bác sĩ / Chuyên gia', kw: ['bác sĩ', 'chuyên gia', 'dược sĩ', 'chuyên gia dinh dưỡng', 'luật sư', 'doctor', 'giảng viên'] },
        { id: 'spiritual', label: 'Tâm linh / Chiêm tinh', kw: ['tâm linh', 'chiêm tinh', 'tarot', 'phong thủy', 'cung hoàng đạo', 'thần số học'] },
        { id: 'community', label: 'Community / Page tổng hợp', kw: ['community', 'page comic', 'comic', 'fanpage', 'page tổng hợp', 'trang tin', 'mass page', 'showbiz', 'group'] },
        { id: 'kids', label: 'Kid influencer', kw: ['kid influencer', 'kol nhí', 'bé nhà', 'em bé review'] },
    ];

    const PLATFORMS = [
        { id: 'TikTok', label: 'TikTok', re: /tik\s?tok/ },
        { id: 'FB', label: 'Facebook', re: /facebook|\bfb\b|reels? fb/ },
        { id: 'YT', label: 'YouTube', re: /youtube|\byt\b|shorts/ },
        { id: 'Threads', label: 'Threads', re: /threads/ },
        { id: 'Instagram', label: 'Instagram', re: /instagram|\big\b/ },
    ];

    const TIERS = [
        { id: 'nano', label: 'Nano (<10K)', min: 0, max: 10000 },
        { id: 'micro', label: 'Micro (10K–100K)', min: 10000, max: 100000 },
        { id: 'mid', label: 'Mid (100K–500K)', min: 100000, max: 500000 },
        { id: 'macro', label: 'Macro (500K–1M)', min: 500000, max: 1000000 },
        { id: 'mega', label: 'Mega (>1M)', min: 1000000, max: Infinity },
    ];

    const AGES = ['13-17', '18-24', '25-34', '35-44', '45+'];
    const AGE_BOUNDS = { '13-17': [13, 17], '18-24': [18, 24], '25-34': [25, 34], '35-44': [35, 44], '45+': [45, 99] };

    const GENDERS = [
        { id: 'nu', label: 'Chủ yếu nữ' },
        { id: 'nam', label: 'Chủ yếu nam' },
        { id: 'all', label: 'Cân bằng' },
    ];

    const LOCATIONS = [
        { id: 'Toàn quốc', re: /toàn quốc|cả nước|nationwide/ },
        { id: 'TP.HCM', re: /hồ chí minh|\bhcm\b|tp\.?\s?hcm|sài gòn|saigon|\bsg\b/ },
        { id: 'Hà Nội', re: /hà nội|\bhn\b|ha noi|hanoi/ },
        { id: 'Đà Nẵng', re: /đà nẵng|da nang/ },
        { id: 'Cần Thơ', re: /cần thơ|can tho/ },
        { id: 'Hải Phòng', re: /hải phòng|hai phong/ },
        { id: 'Miền Bắc', re: /miền bắc/ },
        { id: 'Miền Trung', re: /miền trung/ },
        { id: 'Miền Nam', re: /miền nam/ },
    ];
    const REGION_OF = { 'Hà Nội': 'Miền Bắc', 'Hải Phòng': 'Miền Bắc', 'Đà Nẵng': 'Miền Trung', 'TP.HCM': 'Miền Nam', 'Cần Thơ': 'Miền Nam' };

    // ================= HELPERS =================
    const norm = (s) => String(s ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
    const uniq = (arr) => Array.from(new Set(arr));
    const asArray = (v) => Array.isArray(v) ? v : (v === undefined || v === null || v === '' ? [] : String(v).split(/[,;|/]+/).map(s => s.trim()).filter(Boolean));

    /**
     * Parse Vietnamese-style numbers and shorthands.
     * "10.000.000" -> 10000000, "120k" -> 120000, "1,2M" -> 1200000, "3tr" -> 3000000, "1 tỷ" -> 1e9.
     * Returns NaN when the input is not a number.
     */
    const parseNumber = (value) => {
        if (value === null || value === undefined) return NaN;
        if (typeof value === 'number') return value;
        const s = String(value).trim().toLowerCase().replace(/\s+/g, '').replace(/₫|vnđ|vnd|đ|%/g, '');
        if (!s) return NaN;
        const m = s.match(/^(\d[\d.,]*)(k|n|nghìn|ngàn|m|tr|triệu|trieu|b|tỷ|ty)?$/);
        if (!m) return NaN;
        let num = m[1];
        const unit = m[2];
        const multipliers = { k: 1e3, n: 1e3, 'nghìn': 1e3, 'ngàn': 1e3, m: 1e6, tr: 1e6, 'triệu': 1e6, trieu: 1e6, b: 1e9, 'tỷ': 1e9, ty: 1e9 };
        const seps = num.match(/[.,]/g) || [];
        if (seps.length === 1 && (unit || !/[.,]\d{3}$/.test(num))) num = num.replace(',', '.');
        else if (seps.length) num = num.replace(/[.,]/g, '');
        const n = parseFloat(num);
        if (isNaN(n)) return NaN;
        return Math.round(n * (unit ? multipliers[unit] : 1) * 100) / 100;
    };
    const numOr = (v, d = 0) => { const n = parseNumber(v); return isNaN(n) ? d : n; };

    const formatShort = (n) => {
        n = Number(n) || 0;
        if (n >= 1e9) return +(n / 1e9).toFixed(1) + ' tỷ';
        if (n >= 1e6) return +(n / 1e6).toFixed(1) + 'tr';
        if (n >= 1e3) return +(n / 1e3).toFixed(1) + 'k';
        return String(Math.round(n));
    };
    const formatFollowers = (n) => {
        n = Number(n) || 0;
        if (n >= 1e6) return +(n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return +(n / 1e3).toFixed(1) + 'K';
        return String(Math.round(n));
    };

    // ================= PRICING (agency PRE PNL template) =================
    // External: C = A × discount% × B ; D = A × B − C
    // Internal: E = X × O ; F = tax(E) ; G (phí giới thiệu / CB) = D × cb% ; H = G / 9 ; M = backup
    // K (lợi nhuận gộp) = D − E − F − G − H − M ; L (margin) = K / D
    const TAX_TYPES = ['PIT', 'VAT', 'HKD'];
    // Default rates (configurable per agency with configureRates):
    // booking tax as % of E (PIT = E / 9), tax on CB as % of G (H = G / 9), cost backup per committed KPI unit
    const BACKUP_RATES = {
        TikTok: { view: 3.5, eng: 0 },
        FB: { view: 15, eng: 35 },
        YT: { view: 35, eng: 0 },
        Threads: { view: 0, eng: 700 },
        Instagram: { view: 15, eng: 0 },
    };
    const DEFAULT_RATES = { tax: { PIT: 100 / 9, VAT: 0, HKD: 7 }, cbTaxPct: 100 / 9, backup: BACKUP_RATES };
    const cloneRates = (r) => JSON.parse(JSON.stringify(r));
    let RATES = cloneRates(DEFAULT_RATES);
    const finite = (v, d) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : d);
    const configureRates = (r = {}) => {
        const d = DEFAULT_RATES;
        const tax = {}; TAX_TYPES.forEach(t => { tax[t] = finite(r.tax && r.tax[t], d.tax[t]); });
        const backup = {};
        Object.keys(d.backup).forEach(p => { const x = (r.backup && r.backup[p]) || {}; backup[p] = { view: finite(x.view, d.backup[p].view), eng: finite(x.eng, d.backup[p].eng) }; });
        RATES = { tax, cbTaxPct: finite(r.cbTaxPct, d.cbTaxPct), backup };
        return getRates();
    };
    const getRates = () => cloneRates(RATES);
    const taxExact = (amount, taxType) => amount * (RATES.tax[taxType] || 0) / 100;
    const calcTax = (cost, taxType) => Math.round(taxExact(cost, taxType));
    const calcBackup = (platform, kpiView, kpiEng) => {
        const r = RATES.backup[platform] || { view: 0, eng: 0 };
        return (Number(kpiView) || 0) * r.view + (Number(kpiEng) || 0) * r.eng;
    };

    const PRICING_DEFAULTS = { mode: 'margin', pct: 35, discountPct: 5, cbPct: 5, roundTo: 100000 };

    /** Full PRE PNL line. All inputs are numbers; results are unrounded (round only for display). */
    const calcPnl = (i = {}) => {
        const num0 = (v, d = 0) => { const n = typeof v === 'number' ? v : numOr(v, d); return isFinite(n) ? n : d; };
        const A = num0(i.A), B = i.B === undefined || i.B === '' ? 1 : num0(i.B);
        const X = num0(i.X), O = i.O === undefined || i.O === '' ? 1 : num0(i.O);
        const discountPct = num0(i.discountPct), cbPct = num0(i.cbPct);
        const view = num0(i.kpiView), eng = num0(i.kpiEng);
        const C = A * discountPct / 100 * B;
        const D = A * B - C;
        const E = X * O;
        const F = taxExact(E, i.taxType);
        const G = D * cbPct / 100;
        const H = G * RATES.cbTaxPct / 100;
        const M = i.backup !== undefined && i.backup !== null && i.backup !== '' ? num0(i.backup) : calcBackup(i.platform, view, eng);
        const K = D - E - F - G - H - M;
        const L = D ? K / D : 0;
        return { A, B, C, D, X, O, E, F, G, H, M, K, L, discountPct, cbPct, kpiView: view, kpiEng: eng, CPV: view ? D / view : 0, CPE: eng ? D / eng : 0 };
    };

    const roundUp = (n, step) => step > 0 ? Math.ceil(n / step - 1e-9) * step : Math.round(n);

    /**
     * Unit selling price A for a target.
     * mode 'margin': margin L on D reaches pct (after discount, CB, CB tax, booking tax, backup)
     * mode 'markup': D = (E + F + M) × (1 + pct)
     */
    const solvePrice = (i = {}) => {
        const o = { ...PRICING_DEFAULTS, ...i };
        const base = calcPnl({ ...o, A: 0 });
        const cost = base.E + base.F + base.M;
        if (!cost) return 0;
        let D;
        if (o.mode === 'markup') D = cost * (1 + (Number(o.pct) || 0) / 100);
        else {
            const denom = 1 - (Number(o.cbPct) || 0) / 100 * (1 + RATES.cbTaxPct / 100) - (Number(o.pct) || 0) / 100;
            if (denom <= 0) return 0;
            D = cost / denom;
        }
        const B = o.B === undefined || o.B === '' ? 1 : Number(o.B) || 1;
        const A = D / (B * (1 - (Number(o.discountPct) || 0) / 100));
        return roundUp(A, Number(o.roundTo) || 0);
    };

    /** Estimated price to the brand (D) for one deliverable of a KOC (backup not included: KPI unknown at matching time). */
    const estimatePrice = (koc, pricing = {}) => {
        const rate = numOr(koc.rate);
        if (!rate) return 0;
        const p = { ...PRICING_DEFAULTS, ...pricing };
        const A = solvePrice({ ...p, X: rate, O: 1, B: 1, taxType: koc.taxType || 'PIT', backup: 0 });
        return Math.round(calcPnl({ ...p, A, B: 1, X: rate, O: 1, taxType: koc.taxType || 'PIT', backup: 0 }).D);
    };
    // kept for compatibility
    const priceFromCost = (fullCost, mode, pct) => {
        pct = Number(pct) || 0;
        if (mode === 'margin') return pct >= 100 ? 0 : Math.round(fullCost / (1 - pct / 100));
        return Math.round(fullCost * (1 + pct / 100));
    };

    // ================= DETECTION =================
    const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hasTerm = (text, term) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(term)}(?=[^\\p{L}\\p{N}]|$)`, 'u').test(text);
    const CATEGORY_TERMS = CATEGORIES.map(c => ({ id: c.id, terms: uniq([c.id, ...norm(c.label).split(' / '), ...c.kw.map(norm)]) }));
    const detectCategories = (text) => {
        const t = norm(text);
        if (!t) return [];
        return CATEGORY_TERMS.filter(c => c.terms.some(term => hasTerm(t, term))).map(c => c.id);
    };
    const detectPlatforms = (text) => { const t = norm(text); return PLATFORMS.filter(p => p.re.test(t)).map(p => p.id); };
    const detectLocations = (text) => { const t = norm(text); return LOCATIONS.filter(l => l.re.test(t)).map(l => l.id); };
    const normalizePlatform = (v) => {
        const t = norm(v);
        if (!t) return '';
        const exact = PLATFORMS.find(p => norm(p.id) === t || norm(p.label) === t);
        if (exact) return exact.id;
        return detectPlatforms(t)[0] || String(v).trim();
    };
    const normalizeGender = (v) => {
        const t = norm(v);
        if (!t) return '';
        if (/^(nu|nữ|female|f|chủ yếu nữ|women)$/.test(t) || /nữ/.test(t) && !/nam/.test(t)) return 'nu';
        if (/^(nam|male|m|chủ yếu nam|men)$/.test(t) || /nam/.test(t) && !/nữ/.test(t)) return 'nam';
        return 'all';
    };
    const ageGroupsFromRange = (a, b) => AGES.filter(g => { const [lo, hi] = AGE_BOUNDS[g]; return lo <= b && hi >= a; });
    const normalizeAges = (v) => {
        const out = [];
        asArray(v).forEach(part => {
            const p = part.replace(/\s/g, '');
            if (AGES.includes(p)) { out.push(p); return; }
            const m = p.match(/(\d{2})[-–~](\d{2})/);
            if (m) out.push(...ageGroupsFromRange(+m[1], +m[2]));
            else if (/^(\d{2})\+$/.test(p)) out.push(...ageGroupsFromRange(+p.slice(0, 2), 99));
        });
        return uniq(out);
    };
    const tierOf = (followers) => {
        const f = numOr(followers);
        if (!f) return null;
        return TIERS.find(t => f >= t.min && f < t.max)?.id || null;
    };

    // ================= BRIEF PARSER (no AI) =================
    const parseBriefText = (text) => {
        const raw = String(text || '');
        const t = norm(raw);
        const brief = { categories: detectCategories(raw), platforms: detectPlatforms(raw), locations: detectLocations(raw) };

        const anyTerm = (terms) => terms.some(term => hasTerm(t, term));
        const female = anyTerm(['phụ nữ', 'chị em', 'nữ giới', 'nữ', 'các nàng', 'female', 'women']);
        const male = anyTerm(['nam giới', 'đàn ông', 'phái mạnh', 'male', 'men', 'các chàng', 'quý ông']);
        const both = anyTerm(['cả nam và nữ', 'cả nam lẫn nữ', 'nam nữ', 'nam và nữ', 'unisex']);
        if (!both && female && !male) brief.gender = 'nu';
        else if (!both && male && !female) brief.gender = 'nam';

        const ages = [];
        const ageRe = /(\d{2})\s*(?:-|–|~|đến|tới|to)\s*(\d{2})\s*(?:tuổi|t\b|yo|years?)?/g;
        let m;
        while ((m = ageRe.exec(t))) {
            const a = +m[1], b = +m[2];
            const ctx = t.slice(Math.max(0, m.index - 15), m.index + m[0].length + 8);
            if (a >= 10 && b <= 70 && a < b && /(tuổi|độ tuổi|age|yo|gen|khách hàng|target|đối tượng)/.test(ctx)) ages.push(...ageGroupsFromRange(a, b));
        }
        if (/gen\s?z/.test(t)) ages.push('18-24');
        if (/sinh viên|học sinh/.test(t)) ages.push('18-24');
        if (/dân văn phòng|người đi làm|mẹ bỉm|mẹ bầu/.test(t)) ages.push('25-34');
        brief.ages = uniq(ages);

        const tiers = TIERS.filter(x => new RegExp(`\\b${x.id}\\b`).test(t)).map(x => x.id);
        brief.tiers = tiers;

        const money = '(\\d[\\d.,]*\\s*(?:tỷ|ty|triệu|trieu|tr|k|m|đ|vnđ|vnd)?)';
        const budgetMatch = t.match(new RegExp(`(?:tổng ngân sách|ngân sách|budget|kinh phí|chi phí)[^\\d\\n]{0,25}${money}`));
        if (budgetMatch) {
            const n = parseNumber(budgetMatch[1].replace(/\s/g, ''));
            if (!isNaN(n) && n >= 1e5) brief.totalBudget = n;
        }
        const countMatch = t.match(/(\d{1,3})\s*(?:koc|kol|creator|influencer|tiktoker|kênh|reviewer|người ảnh hưởng)/);
        if (countMatch) brief.kocCount = +countMatch[1];

        const erMatch = t.match(/(?:er|engagement|tương tác)[^\d\n]{0,15}(\d+(?:[.,]\d+)?)\s*%/);
        if (erMatch) brief.minER = parseFloat(erMatch[1].replace(',', '.'));

        const brandMatch = raw.match(/(?:brand|nhãn hàng|thương hiệu|client|khách hàng)\s*[:\-–]\s*([^\n,.;]+)/i);
        if (brandMatch) brief.brand = brandMatch[1].trim();
        const productMatch = raw.match(/(?:sản phẩm|product)\s*[:\-–]\s*([^\n;]+)/i);
        if (productMatch) brief.product = productMatch[1].trim();
        const delivMatch = raw.match(/(\d+\s*(?:video|clip|bài đăng|bài|post|livestream|story|reels?)[^\n.;]*)/i);
        if (delivMatch) brief.deliverable = delivMatch[1].trim();

        return brief;
    };

    /** Clean up a brief coming from the AI or a form into a consistent shape. */
    const normalizeBrief = (b = {}) => ({
        brand: String(b.brand || '').trim(),
        product: String(b.product || '').trim(),
        deliverable: String(b.deliverable || '').trim(),
        categories: uniq(asArray(b.categories).map(c => CATEGORIES.find(x => x.id === c) ? c : detectCategories(c)[0]).filter(Boolean)),
        platforms: uniq(asArray(b.platforms).map(normalizePlatform).filter(p => PLATFORMS.some(x => x.id === p))),
        gender: ['nu', 'nam'].includes(b.gender) ? b.gender : (b.gender ? (normalizeGender(b.gender) === 'all' ? '' : normalizeGender(b.gender)) : ''),
        ages: normalizeAges(b.ages),
        locations: uniq(asArray(b.locations).map(l => LOCATIONS.find(x => x.id === l)?.id || detectLocations(l)[0]).filter(Boolean)),
        tiers: uniq(asArray(b.tiers).filter(t => TIERS.some(x => x.id === t))),
        totalBudget: numOr(b.totalBudget),
        kocCount: Math.max(0, Math.round(numOr(b.kocCount))),
        minER: numOr(b.minER),
        keywords: uniq(asArray(b.keywords).map(k => k.trim()).filter(Boolean)),
    });

    // ================= SCORING =================
    const WEIGHTS = { category: 30, budget: 20, audience: 15, performance: 15, tier: 10, quality: 10 };

    /**
     * Score one KOC against a brief.
     * ctx: { pricing: {mode,pct,discountPct,cbPct,roundTo}, isBlacklisted(koc) -> bool }
     * Returns { koc, score (0-100), price, excluded (string|null), reasons: [{type:'good'|'warn'|'bad'|'info', text}] }
     */
    const scoreKoc = (koc, briefIn, ctx = {}) => {
        const brief = normalizeBrief(briefIn);
        const reasons = [];
        const add = (type, text) => reasons.push({ type, text });
        const price = estimatePrice(koc, ctx.pricing);
        let excluded = null;
        let score = 0;

        // ---- Hard filters ----
        if (ctx.isBlacklisted && ctx.isBlacklisted(koc)) excluded = 'Nằm trong blacklist';
        else if (brief.platforms.length && !brief.platforms.includes(normalizePlatform(koc.platform))) excluded = `Nền tảng ${koc.platform || '?'} không có trong brief`;
        else if (brief.totalBudget && price > brief.totalBudget) excluded = 'Giá vượt tổng ngân sách';
        else if (koc.status === 'inactive') excluded = 'KOC đang tạm ngưng hợp tác';

        // ---- Category (30) ----
        let categoryMismatch = false;
        const kocCats = asArray(koc.categories);
        if (!brief.categories.length) {
            score += WEIGHTS.category / 2;
        } else {
            const hit = brief.categories.filter(c => kocCats.includes(c));
            if (hit.length) {
                score += WEIGHTS.category;
                add('good', `Đúng ngành: ${hit.map(id => CATEGORIES.find(c => c.id === id)?.label || id).join(', ')}`);
            } else {
                const textHit = detectCategories(`${koc.notes || ''} ${koc.tags || ''}`).filter(c => brief.categories.includes(c));
                if (textHit.length) { score += WEIGHTS.category * 0.4; add('warn', 'Có nội dung liên quan ngành (theo ghi chú), nhưng không phải ngành chính'); }
                else { add('bad', 'Khác ngành với brief'); categoryMismatch = true; }
            }
        }

        // ---- Budget (20) ----
        const perKoc = brief.totalBudget && brief.kocCount ? brief.totalBudget / brief.kocCount : 0;
        if (!price) {
            score += WEIGHTS.budget * 0.3;
            add('warn', 'Chưa có giá nhập của KOC');
        } else if (perKoc) {
            if (price <= perKoc) { score += WEIGHTS.budget; add('good', `Giá ước tính ${formatShort(price)} trong ngân sách/KOC (${formatShort(perKoc)})`); }
            else if (price <= perKoc * 1.25) { score += WEIGHTS.budget * 0.5; add('warn', `Giá ước tính ${formatShort(price)} vượt nhẹ ngân sách/KOC (${formatShort(perKoc)})`); }
            else { add('bad', `Giá ước tính ${formatShort(price)} vượt xa ngân sách/KOC (${formatShort(perKoc)})`); }
        } else {
            score += WEIGHTS.budget / 2;
        }

        // ---- Audience (15): gender 5, age 5, location 5 ----
        const kg = normalizeGender(koc.gender);
        if (!brief.gender) score += 5;
        else if (kg === brief.gender) { score += 5; add('good', `Khán giả ${brief.gender === 'nu' ? 'nữ' : 'nam'} đúng target`); }
        else if (kg === 'all' || !kg) score += 3;
        else add('bad', `Khán giả chủ yếu ${kg === 'nu' ? 'nữ' : 'nam'}, lệch target`);

        const kAges = normalizeAges(koc.ages);
        if (!brief.ages.length) score += 5;
        else if (!kAges.length) score += 2.5;
        else {
            const overlap = brief.ages.filter(a => kAges.includes(a));
            if (overlap.length) { score += 5 * Math.min(1, overlap.length / Math.min(brief.ages.length, kAges.length)); add('good', `Độ tuổi khán giả khớp ${overlap.join(', ')}`); }
            else add('bad', `Độ tuổi khán giả (${kAges.join(', ')}) lệch target`);
        }

        const kLoc = LOCATIONS.find(l => l.id === koc.location)?.id || detectLocations(koc.location)[0] || '';
        if (!brief.locations.length || brief.locations.includes('Toàn quốc')) score += 5;
        else if (!kLoc) score += 2.5;
        else if (brief.locations.includes(kLoc)) { score += 5; add('good', `Khu vực ${kLoc} đúng target`); }
        else if (kLoc === 'Toàn quốc' || brief.locations.includes(REGION_OF[kLoc]) || brief.locations.some(l => REGION_OF[l] === kLoc)) score += 3.5;
        else add('warn', `Khu vực ${kLoc} không nằm trong target`);

        // ---- Performance (15): ER 8, view/follower 7 ----
        const followers = numOr(koc.followers);
        const views = numOr(koc.avgViews);
        const er = numOr(koc.er);
        if (er) {
            score += 8 * Math.min(1, er / 6);
            if (brief.minER && er < brief.minER) add('bad', `ER ${er}% thấp hơn yêu cầu ${brief.minER}%`);
            else if (er >= 5) add('good', `Tương tác tốt (ER ${er}%)`);
        } else { score += 3; add('info', 'Chưa có ER'); }
        if (views && followers) {
            const ratio = views / followers;
            score += 7 * Math.min(1, ratio / 0.3);
            if (ratio >= 0.3) add('good', `View TB ${formatFollowers(views)} (${Math.round(ratio * 100)}% follower)`);
            else if (ratio < 0.05) add('warn', `View TB thấp so với follower (${(ratio * 100).toFixed(1)}%)`);
        } else score += 3;
        if (price && views) add('info', `CPV ước tính ${Math.round(price / views).toLocaleString('vi-VN')}đ/view`);

        // ---- Tier (10) ----
        const tier = tierOf(followers);
        if (!brief.tiers.length) score += WEIGHTS.tier / 2;
        else if (!tier) score += 2;
        else if (brief.tiers.includes(tier)) { score += WEIGHTS.tier; add('good', `Đúng phân khúc ${TIERS.find(t => t.id === tier).label}`); }
        else {
            const idx = TIERS.findIndex(t => t.id === tier);
            const near = brief.tiers.some(b => Math.abs(TIERS.findIndex(t => t.id === b) - idx) === 1);
            score += near ? 4 : 0;
            add(near ? 'warn' : 'bad', `Phân khúc ${TIERS[idx].label} ${near ? 'gần' : 'khác'} yêu cầu`);
        }

        // ---- Quality (10): internal rating 6 + keyword match 4 ----
        const rating = numOr(koc.rating);
        score += rating ? 6 * Math.min(1, rating / 5) : 3;
        if (rating >= 4) add('good', `Đánh giá nội bộ ${rating}/5`);
        else if (rating && rating <= 2) add('warn', `Đánh giá nội bộ thấp (${rating}/5)`);
        if (brief.keywords.length) {
            const hay = norm(`${koc.name} ${koc.notes || ''} ${koc.tags || ''}`);
            const hits = brief.keywords.filter(k => hay.includes(norm(k)));
            score += 4 * Math.min(1, hits.length / Math.min(2, brief.keywords.length));
            if (hits.length) add('good', `Khớp từ khóa: ${hits.join(', ')}`);
        } else score += 2;

        // Industry fit matters most: a KOC outside the brief's industry is heavily discounted.
        if (categoryMismatch) score *= 0.6;
        return { koc, score: Math.round(Math.max(0, Math.min(100, score))), price, excluded, reasons };
    };

    /** Rank all KOCs. Returns { matches (sorted desc), excluded }. */
    const rankKocs = (kocs, brief, ctx = {}) => {
        const all = (kocs || []).map(k => scoreKoc(k, brief, ctx));
        const matches = all.filter(r => !r.excluded).sort((a, b) => b.score - a.score || (a.price || Infinity) - (b.price || Infinity));
        const excluded = all.filter(r => r.excluded);
        return { matches, excluded };
    };

    /**
     * Pick a shortlist: highest scores first, within total budget, up to kocCount.
     * Skips the same person on several platforms (same normalized name) unless needed.
     */
    const pickShortlist = (matches, briefIn, { minScore = 40 } = {}) => {
        const brief = normalizeBrief(briefIn);
        const limit = brief.kocCount || 10;
        const picked = [];
        let total = 0;
        const names = new Set();
        for (const r of matches) {
            if (picked.length >= limit) break;
            if (r.score < minScore) continue;
            if (names.has(norm(r.koc.name))) continue;
            if (brief.totalBudget && total + r.price > brief.totalBudget) continue;
            picked.push(r);
            total += r.price;
            names.add(norm(r.koc.name));
        }
        return { picked, total, remaining: brief.totalBudget ? brief.totalBudget - total : null };
    };

    // ================= CSV / TSV =================
    const parseDelimited = (text) => {
        const src = String(text || '').replace(/^﻿/, '');
        const firstLine = src.split(/\r?\n/)[0] || '';
        const delim = firstLine.includes('\t') ? '\t' : (firstLine.split(';').length > firstLine.split(',').length ? ';' : ',');
        const rows = [];
        let row = [], cell = '', q = false;
        for (let i = 0; i < src.length; i++) {
            const c = src[i];
            if (q) {
                if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
                else if (c === '"') q = false;
                else cell += c;
            } else if (c === '"' && cell === '') q = true;
            else if (c === delim) { row.push(cell); cell = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && src[i + 1] === '\n') i++;
                row.push(cell); rows.push(row); row = []; cell = '';
            } else cell += c;
        }
        if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
        return rows.filter(r => r.some(c => String(c).trim() !== ''));
    };

    // Column recognition: exact header names first, then patterns. Headers are normalized (lowercase, single spaces).
    const FIELD_RULES = {
        koc: [
            ['name', ['tên', 'ten', 'name', 'koc', 'kol', 'kols', 'kocs', 'tên koc', 'tên kol', 'tên kênh', 'kênh', 'creator', 'influencer', 'kols/kocs', 'hạng mục'], /^(tên|kols?|kocs?)\b/],
            ['platform', ['nền tảng', 'platform', 'mxh', 'mạng xã hội'], /nền tảng|platform/],
            ['link', ['link', 'url', 'link kênh', 'profile', 'link profile', 'channel'], /^link|url/],
            ['contact', ['contact', 'liên hệ', 'sđt', 'sdt', 'zalo', 'phone', 'số điện thoại', 'email'], /contact|liên hệ|sđt|điện thoại/],
            ['followers', ['followers', 'follower', 'follow', 'lượt theo dõi', 'người theo dõi', 'subs', 'subscribers', 'social'], /follow|theo dõi|subscriber/],
            ['avgViews', ['view tb', 'avg views', 'avg view', 'average views', 'view trung bình', 'lượt xem tb', 'lượt xem trung bình'], /view (tb|trung bình)|avg/],
            ['er', ['er', 'er (%)', 'engagement rate', 'tỷ lệ tương tác'], /engagement rate|tỷ lệ tương tác/],
            ['categories', ['ngành', 'lĩnh vực', 'category', 'categories', 'chủ đề', 'niche', 'ngành hàng', 'nhóm', 'nhóm koc', 'type of channel', 'phân loại', 'nhóm/ngành'], /ngành|lĩnh vực|categor|type of channel/],
            ['gender', ['giới tính khán giả', 'giới tính', 'gender', 'audience gender', 'giới tính kg'], /giới tính|gender/],
            ['ages', ['độ tuổi khán giả', 'độ tuổi', 'age', 'ages', 'audience age', 'độ tuổi kg'], /độ tuổi|\bage/],
            ['location', ['khu vực', 'location', 'tỉnh', 'thành phố', 'vùng'], /khu vực|location/],
            ['rate', ['giá nhập', 'cost booking', 'đơn giá booking', 'đơn giá booking (x)', 'internal cost', 'internal cost tm', 'giá booking', 'giá gốc', 'rate', 'cost'], /cost booking|đơn giá booking|internal cost|giá nhập/],
            ['lastQuote', ['chi phí', 'chi phí (a)', 'external cost', 'giá bán', 'giá bán gần nhất', 'báo giá', 'đơn giá'], /^chi phí( \(a\))?$|external cost|giá bán/],
            ['scope', ['hạng mục công việc', 'scope', 'scope of work', 'hạng mục cv'], /hạng mục công việc|scope/],
            ['taxType', ['loại thuế', 'loại thuế (y)', 'thuế', 'tax', 'tax type'], /^loại thuế/],
            ['rating', ['đánh giá', 'rating', 'điểm'], null],
            ['paymentTerm', ['payment term', 'thanh toán', 'điều khoản thanh toán'], /payment/],
            ['notes', ['ghi chú', 'notes', 'note', 'note (internal)', 'mô tả', 'phong cách', 'style'], /^note|ghi chú/],
        ],
        blacklist: [
            ['name', ['name', 'tên', 'kol', 'koc', 'kols', 'kocs', 'tên kênh', 'kênh'], /^(tên|name|kols?|kocs?)\b/],
            ['link', ['link', 'link kênh', 'url', 'profile'], /^link|url/],
            ['project', ['dự án', 'project', 'campaign', 'chiến dịch'], /dự án|campaign/],
            ['reason', ['note', 'lý do', 'ghi chú', 'reason', 'nguyên nhân'], /lý do|note|ghi chú/],
        ],
    };
    const FIELD_LABELS = {
        name: 'Tên', platform: 'Nền tảng', link: 'Link', contact: 'Contact', followers: 'Followers', avgViews: 'View TB', er: 'ER (%)',
        categories: 'Nhóm / Ngành', gender: 'Giới tính khán giả', ages: 'Độ tuổi khán giả', location: 'Khu vực', rate: 'Giá nhập (đơn giá booking)',
        lastQuote: 'Giá bán gần nhất', scope: 'Hạng mục công việc', taxType: 'Loại thuế', rating: 'Đánh giá', paymentTerm: 'Payment term', notes: 'Ghi chú',
        project: 'Dự án', reason: 'Lý do',
    };
    const normHeader = (h) => norm(String(h ?? '').replace(/[\r\n]+/g, ' ')).replace(/:$/, '');
    const mapHeader = (h, target = 'koc') => {
        const t = normHeader(h);
        if (!t) return null;
        const rules = FIELD_RULES[target] || FIELD_RULES.koc;
        for (const [field, exact] of rules) if (exact.includes(t)) return field;
        for (const [field, , re] of rules) if (re && re.test(t)) return field;
        return null;
    };
    const mapHeaderRow = (cells, target) => {
        const used = new Set();
        return cells.map(c => { const f = mapHeader(c, target); if (!f || used.has(f)) return null; used.add(f); return f; });
    };
    const scoreHeader = (fields, target) => {
        const set = new Set(fields.filter(Boolean));
        const key = target === 'blacklist' ? (set.has('name') || set.has('link')) : set.has('name');
        return key ? set.size : 0;
    };

    /**
     * Find the header row in a sheet-like 2D array (title rows, 2-level merged headers are common in agency files).
     * Returns { headerRow, dataStart, labels[], fields[] } or null.
     */
    const detectTable = (rows, target = 'koc') => {
        let best = null;
        const limit = Math.min(rows.length, 25);
        for (let r = 0; r < limit; r++) {
            if ((rows[r] || []).filter(c => String(c ?? '').trim() !== '').length < 2) continue; // titles / blank rows are not headers
            const width = Math.max(rows[r].length, (rows[r + 1] || []).length);
            const single = Array.from({ length: width }, (_, i) => rows[r][i] ?? '');
            const combined = single.map((c, i) => {
                const below = (rows[r + 1] || [])[i];
                return below !== undefined && below !== null && String(below).trim() !== '' && isNaN(numOr(below, NaN)) ? below : c;
            });
            for (const [labels, dataStart] of [[single, r + 1], [combined, r + 2]]) {
                const fields = mapHeaderRow(labels, target);
                const score = scoreHeader(fields, target);
                if (score && (!best || score > best.score)) best = { headerRow: r, dataStart, labels: labels.map(l => String(l ?? '').replace(/\s+/g, ' ').trim()), fields, score };
            }
        }
        return best;
    };

    const SECTION_RE = /^\s*([A-Z]|[IVX]{1,4})\s*[.)]\s*(\S.*)$/;
    /** Rows -> objects using a field mapping. Section rows like "A. BOOKING ON TIKTOK" are attached to following rows. */
    const tableToObjects = (rows, table, fields) => {
        const out = [];
        let section = '';
        let skipped = 0;
        const keyField = fields.includes('name') ? 'name' : 'link';
        for (let r = table.dataStart; r < rows.length; r++) {
            const cells = rows[r] || [];
            const nonEmpty = cells.map(c => String(c ?? '').trim()).filter(Boolean);
            if (!nonEmpty.length) continue;
            const obj = {};
            fields.forEach((f, i) => { if (f && obj[f] === undefined) { const v = cells[i]; if (v !== undefined && v !== null && String(v).trim() !== '') obj[f] = v; } });
            if (!obj[keyField]) {
                const m = nonEmpty.length <= 2 && String(nonEmpty[0]).match(SECTION_RE);
                if (m) section = m[2].trim();
                else skipped++;
                continue;
            }
            if (/^(tổng|total|vat|margin)/i.test(String(obj[keyField]))) continue;
            if (section) obj.section = section;
            out.push(obj);
        }
        return { objects: out, skipped };
    };

    /** Section label ("BOOKING ON TIKTOK", "GIA ĐÌNH") -> platform and categories hints. */
    const applySection = (obj) => {
        if (!obj.section) return obj;
        const plat = detectPlatforms(obj.section)[0];
        if (plat && !obj.platform) obj.platform = plat;
        const cats = detectCategories(obj.section);
        if (cats.length) obj.categories = [...asArray(obj.categories), ...cats].join(', ');
        if (!plat && !cats.length) obj.tags = [obj.tags, obj.section].filter(Boolean).join(' ');
        return obj;
    };

    /** Convert a raw row object (strings) into a clean KOC record. */
    const normalizeKoc = (r = {}) => {
        const catLabel = (c) => CATEGORIES.find(x => norm(x.label) === norm(c));
        // split on , ; | only: labels themselves contain "/" ("Làm đẹp / Mỹ phẩm")
        const catParts = Array.isArray(r.categories) ? r.categories : String(r.categories || '').split(/[,;|]+/).map(x => x.trim()).filter(Boolean);
        const cats = catParts.flatMap(c => CATEGORIES.find(x => x.id === c) ? [c] : (catLabel(c) ? [catLabel(c).id] : detectCategories(c)));
        const tax = String(r.taxType || '').toUpperCase().trim();
        return {
            id: r.id || ('k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
            name: String(r.name || '').trim(),
            platform: normalizePlatform(r.platform) || (r.link ? detectPlatforms(r.link)[0] || '' : ''),
            link: String(r.link || '').trim(),
            contact: String(r.contact || '').trim(),
            followers: Math.round(numOr(r.followers)),
            avgViews: Math.round(numOr(r.avgViews)),
            er: Math.round(numOr(r.er) * 100) / 100,
            categories: uniq(cats),
            gender: r.gender ? normalizeGender(r.gender) : '',
            ages: normalizeAges(r.ages),
            location: LOCATIONS.find(l => l.id === r.location)?.id || detectLocations(r.location)[0] || String(r.location || '').trim(),
            rate: Math.round(numOr(r.rate)),
            lastQuote: Math.round(numOr(r.lastQuote)),
            scope: String(r.scope || '').trim(),
            taxType: TAX_TYPES.includes(tax) ? tax : 'PIT',
            rating: Math.min(5, Math.max(0, numOr(r.rating))),
            paymentTerm: String(r.paymentTerm || '').trim(),
            notes: String(r.notes || '').trim(),
            tags: String(r.tags || '').trim(),
            status: r.status === 'inactive' ? 'inactive' : 'active',
            demo: !!r.demo,
            analysis: r.analysis && typeof r.analysis === 'object' ? r.analysis : null,
            updatedAt: r.updatedAt || new Date().toISOString(),
            ...(r.createdAt ? { createdAt: r.createdAt } : {}),
            ...(r.createdBy !== undefined ? { createdBy: String(r.createdBy) } : {}),
            ...(r.updatedBy ? { updatedBy: String(r.updatedBy) } : {}),
        };
    };

    const normalizeBlacklistEntry = (r = {}) => ({
        id: r.id || ('b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
        name: String(r.name || '').trim(),
        link: String(r.link || '').trim(),
        project: String(r.project || '').trim(),
        reason: String(r.reason || '').trim(),
        updatedAt: r.updatedAt || new Date().toISOString(),
        ...(r.createdAt ? { createdAt: r.createdAt } : {}),
        ...(r.createdBy !== undefined ? { createdBy: String(r.createdBy) } : {}),
    });

    /** TikTok/YouTube handle from a profile link, for matching ("https://www.tiktok.com/@abc?x" -> "tiktok:abc"). */
    const handleFromLink = (link) => {
        const t = String(link || '').trim().toLowerCase();
        const m = t.match(/tiktok\.com\/@([^/?#]+)/) || t.match(/youtube\.com\/(@[^/?#]+)/) || t.match(/(?:facebook|instagram|threads)\.(?:com|net)\/(?:@)?([^/?#]+)/);
        if (!m) return '';
        const site = /tiktok/.test(t) ? 'tiktok' : /youtube/.test(t) ? 'youtube' : /facebook/.test(t) ? 'facebook' : /instagram/.test(t) ? 'instagram' : 'threads';
        return site + ':' + decodeURIComponent(m[1]).replace(/^@/, '');
    };

    /**
     * Import a 2D array (from pasted text or an .xlsx sheet).
     * Returns { table, records, skipped, unknownHeaders, error } — records are normalized KOCs or blacklist entries.
     */
    const importTable = (rows, { target = 'koc', fields: fieldOverride } = {}) => {
        const clean = (rows || []).map(r => (r || []).map(c => (c === null || c === undefined) ? '' : c));
        const table = detectTable(clean, target);
        if (!table && !fieldOverride) return { table: null, records: [], skipped: 0, unknownHeaders: [], error: target === 'blacklist' ? 'Không tìm thấy cột Tên hoặc Link' : 'Không tìm thấy cột Tên KOC' };
        const t = table || { headerRow: 0, dataStart: 1, labels: clean[0].map(String), fields: [] };
        const fields = fieldOverride || t.fields;
        const { objects, skipped } = tableToObjects(clean, t, fields);
        const records = objects.map(o => target === 'blacklist' ? normalizeBlacklistEntry(o) : normalizeKoc(applySection(o)));
        const unknownHeaders = t.labels.filter((l, i) => l && !fields[i]);
        return { table: { ...t, fields }, records, skipped, unknownHeaders };
    };

    /** Backward-compatible text import (pasted Excel/Sheets or CSV). Returns { kocs, unknownHeaders, skipped, error }. */
    const importKocsFromText = (text) => {
        const rows = parseDelimited(text);
        if (rows.length < 2) return { kocs: [], unknownHeaders: [], skipped: rows.length, error: 'Cần có dòng tiêu đề và ít nhất 1 dòng dữ liệu' };
        const r = importTable(rows, { target: 'koc' });
        return { kocs: r.records, unknownHeaders: r.unknownHeaders, skipped: r.skipped, error: r.error, table: r.table };
    };

    const EXPORT_COLUMNS = [
        ['name', 'Tên'], ['platform', 'Nền tảng'], ['link', 'Link'], ['contact', 'Contact'], ['followers', 'Followers'],
        ['avgViews', 'View TB'], ['er', 'ER (%)'], ['categories', 'Ngành'], ['gender', 'Giới tính khán giả'],
        ['ages', 'Độ tuổi khán giả'], ['location', 'Khu vực'], ['rate', 'Giá nhập'], ['lastQuote', 'Giá bán gần nhất'],
        ['taxType', 'Loại thuế'], ['scope', 'Hạng mục công việc'], ['rating', 'Đánh giá'], ['paymentTerm', 'Payment term'], ['notes', 'Ghi chú'],
    ];
    const csvCell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const exportKocsToCsv = (kocs) => {
        const lines = [EXPORT_COLUMNS.map(c => c[1]).join(',')];
        (kocs || []).forEach(k => {
            lines.push(EXPORT_COLUMNS.map(([f]) => {
                let v = k[f];
                if (f === 'categories') v = asArray(v).map(id => CATEGORIES.find(c => c.id === id)?.label || id).join('; ');
                if (f === 'ages') v = asArray(v).join('; ');
                if (f === 'gender') v = GENDERS.find(g => g.id === v)?.label || '';
                return csvCell(v);
            }).join(','));
        });
        return '﻿' + lines.join('\r\n');
    };


    // ================= PAGE GRAB ANALYSIS (data sent by the bookmarklet) =================
    const removeDiacritics = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    const median = (arr) => {
        const a = arr.filter(n => n > 0).sort((x, y) => x - y);
        if (!a.length) return 0;
        const mid = Math.floor(a.length / 2);
        return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
    };

    /** WebVTT / SRT subtitles -> plain text (deduplicated lines). */
    const parseSubtitles = (raw) => {
        const lines = String(raw || '').replace(/\r/g, '').split('\n');
        const out = [];
        for (const line of lines) {
            const l = line.trim();
            if (!l || /^WEBVTT/.test(l) || /^\d+$/.test(l) || /-->/.test(l) || /^(NOTE|STYLE|REGION)\b/.test(l)) continue;
            const clean = l.replace(/<[^>]+>/g, '').trim();
            if (clean && out[out.length - 1] !== clean) out.push(clean);
        }
        return out.join(' ').replace(/\s{2,}/g, ' ').trim();
    };

    const SPONSORED_RE = /(#ad\b|#ads\b|#quangcao|#quảngcáo|#sponsored|#hoptac|#hợptác|#partner|#tiktokshop|#affiliate|hợp tác (cùng|với)|tài trợ|nhà tài trợ|link (ở |trong )?bio|giỏ hàng|mã giảm giá|\bvoucher\b|\bcode giảm\b|sponsored by|in partnership)/i;
    const HASHTAG_RE = /#([\p{L}\p{N}_]+)/gu;

    const categoryCounts = (texts) => {
        const counts = {};
        texts.forEach(t => detectCategories(t).forEach(c => { counts[c] = (counts[c] || 0) + 1; }));
        return counts;
    };

    /**
     * Rule-based analysis of the data a bookmarklet grabbed from a TikTok (or other) page.
     * Returns a summary object and a KOC-shaped draft (not yet normalized).
     */
    const summarizeGrab = (p = {}) => {
        const videos = Array.isArray(p.videos) ? p.videos.slice(0, 60) : [];
        const cleanDesc = (d) => String(d || '').replace(/\s+created by .*$/i, '').replace(/\s+được tạo bởi .*$/i, '').trim();
        const captions = videos.map(v => cleanDesc(v.desc)).filter(Boolean);
        const video = p.video && typeof p.video === 'object' ? p.video : null;
        const transcript = video && video.transcriptRaw ? parseSubtitles(video.transcriptRaw).slice(0, 12000) : '';
        if (video && video.desc) captions.unshift(cleanDesc(video.desc));

        const followers = Math.round(numOr(p.followers) || numOr(p.followersText));
        const totalLikes = Math.round(numOr(p.likes) || numOr(p.likesText));
        const videoCount = Math.round(numOr(p.videoCount));
        const gridViews = videos.filter(v => !v.pinned).map(v => Math.round(numOr(v.views) || numOr(v.viewsText)));
        let avgViews = median(gridViews);
        if (!avgViews && video) avgViews = Math.round(numOr(video.views) || numOr(video.viewsText));

        let er = 0, erSource = '';
        if (video && numOr(video.views) > 0) {
            const inter = numOr(video.likes) + numOr(video.comments) + numOr(video.shares);
            er = inter / numOr(video.views) * 100;
            erSource = 'video đang xem';
        } else if (totalLikes && videoCount && gridViews.length) {
            // average likes per video vs average (not median) views, both means over the channel
            const allViews = videos.map(v => Math.round(numOr(v.views) || numOr(v.viewsText))).filter(n => n > 0);
            const meanViews = allViews.reduce((a, b) => a + b, 0) / (allViews.length || 1);
            er = meanViews ? (totalLikes / videoCount) / meanViews * 100 : 0;
            erSource = 'ước tính từ tổng tim / số video';
        }
        er = Math.round(Math.min(50, Math.max(0, er)) * 10) / 10;

        const allTexts = [p.bio || '', ...captions, transcript].filter(Boolean);
        const counts = categoryCounts(allTexts);
        const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const top = ranked.length ? ranked[0][1] : 0;
        const categories = ranked.filter(([, n], i) => i < 3 && (n >= 2 || n === top)).map(([c]) => c);

        const tagCounts = {};
        captions.forEach(c => { for (const m of c.matchAll(HASHTAG_RE)) { const t = m[1].toLowerCase(); if (!/^(fyp|foryou|foryoupage|xuhuong|viral|trending|tiktok|xh|fypシ)$/.test(t)) tagCounts[t] = (tagCounts[t] || 0) + 1; } });
        const hashtags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([t]) => t);

        const sponsoredCount = captions.filter(c => SPONSORED_RE.test(c)).length;
        const sponsoredRatio = captions.length ? sponsoredCount / captions.length : 0;
        const locations = detectLocations(allTexts.join(' \n '));

        const handle = String(p.handle || '').replace(/^@/, '');
        const platform = p.source === 'tiktok' ? 'TikTok' : (p.source === 'youtube' ? 'YT' : (detectPlatforms(p.url || '')[0] || ''));
        const link = p.source === 'tiktok' && handle ? `https://www.tiktok.com/@${handle}` : String(p.url || '').split('?')[0];

        return {
            name: String(p.name || handle || '').trim(),
            handle, platform, link,
            bio: String(p.bio || '').trim(),
            followers, totalLikes, videoCount, avgViews, er, erSource,
            videosAnalyzed: captions.length, captions, transcript,
            categories, categoryCounts: counts, hashtags, locations,
            sponsoredCount, sponsoredRatio,
            isVideo: !!video, videoUrl: p.type === 'video' ? String(p.url || '') : '',
            stale: !!(video && video.stale), transcriptError: !!(video && video.transcriptError),
        };
    };

    /** Build TikTok search terms and hashtags from a brief (no AI). */
    const buildSearchTerms = (briefIn) => {
        const b = normalizeBrief(briefIn);
        const terms = [];
        if (b.product) terms.push(`review ${b.product}`);
        b.keywords.forEach(k => terms.push(k));
        const SEARCH_CITY = { 'TP.HCM': 'sài gòn', 'Hà Nội': 'hà nội', 'Đà Nẵng': 'đà nẵng', 'Cần Thơ': 'cần thơ', 'Hải Phòng': 'hải phòng' };
        const city = SEARCH_CITY[b.locations.find(l => SEARCH_CITY[l])];
        b.categories.forEach(id => {
            const c = CATEGORIES.find(x => x.id === id);
            if (!c) return;
            const kws = c.kw.filter(k => k.length > 3 && !/^[a-z&]+$/i.test(k) || ['skincare', 'makeup', 'gaming', 'fitness', 'mukbang', 'outfit'].includes(k)).slice(0, 3);
            kws.forEach(k => terms.push(`review ${k}`));
            if (city && ['fnb', 'travel', 'beauty', 'health'].includes(id)) terms.push(`${kws[0] || c.label} ${city}`);
        });
        if (b.gender === 'nu' && b.categories.includes('beauty')) terms.push('beauty blogger');
        const uniqTerms = uniq(terms.map(t => t.trim().toLowerCase()).filter(Boolean)).slice(0, 10);
        const hashtags = uniq(uniqTerms.map(t => removeDiacritics(t).replace(/[^a-z0-9]/gi, '').toLowerCase()).filter(t => t.length >= 4)).slice(0, 10);
        return { terms: uniqTerms, hashtags };
    };

    return {
        removeDiacritics, median, parseSubtitles, summarizeGrab, buildSearchTerms,
        CATEGORIES, PLATFORMS, TIERS, AGES, GENDERS, LOCATIONS, WEIGHTS,
        parseNumber, formatShort, formatFollowers, norm,
        calcTax, priceFromCost, estimatePrice,
        detectCategories, detectPlatforms, detectLocations, normalizePlatform, normalizeGender, normalizeAges, tierOf,
        parseBriefText, normalizeBrief, scoreKoc, rankKocs, pickShortlist,
        parseDelimited, importKocsFromText, normalizeKoc, exportKocsToCsv, EXPORT_COLUMNS,
        TAX_TYPES, BACKUP_RATES, DEFAULT_RATES, PRICING_DEFAULTS, configureRates, getRates, calcBackup, calcPnl, solvePrice, roundUp,
        FIELD_RULES, FIELD_LABELS, mapHeader, detectTable, importTable, normalizeBlacklistEntry, handleFromLink,
    };
});
