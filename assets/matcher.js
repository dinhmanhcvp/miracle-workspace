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
        { id: 'mombaby', label: 'Mẹ & Bé', kw: ['mẹ và bé', 'mẹ & bé', 'mẹ bỉm', 'em bé', 'trẻ em', 'sữa bột', 'bỉm', 'nuôi con', 'mẹ bầu', 'trẻ nhỏ'] },
        { id: 'health', label: 'Sức khỏe / Thể thao', kw: ['sức khỏe', 'fitness', 'gym', 'thể thao', 'tập luyện', 'giảm cân', 'dinh dưỡng', 'thực phẩm chức năng', 'yoga', 'chạy bộ'] },
        { id: 'travel', label: 'Du lịch', kw: ['du lịch', 'travel', 'khách sạn', 'resort', 'homestay', 'vé máy bay', 'check-in', 'phượt'] },
        { id: 'home', label: 'Nhà cửa / Đời sống', kw: ['nhà cửa', 'gia dụng', 'nội thất', 'decor', 'nhà bếp', 'lifestyle', 'đời sống', 'dọn nhà', 'đồ dùng gia đình'] },
        { id: 'education', label: 'Giáo dục', kw: ['giáo dục', 'tiếng anh', 'khóa học', 'education', 'du học', 'ielts', 'học online', 'kỹ năng'] },
        { id: 'entertainment', label: 'Giải trí / Hài', kw: ['giải trí', 'hài', 'comedy', 'vlog', 'trend', 'âm nhạc', 'ca hát', 'dance', 'nhảy', 'kể chuyện'] },
        { id: 'auto', label: 'Xe cộ', kw: ['ô tô', 'oto', 'xe máy', 'xe điện', 'motor', 'xe hơi'] },
        { id: 'pet', label: 'Thú cưng', kw: ['thú cưng', 'pet', 'chó mèo', 'boss', 'con mèo', 'con chó'] },
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
        const m = s.match(/^(\d[\d.,]*)(k|m|tr|triệu|trieu|b|tỷ|ty)?$/);
        if (!m) return NaN;
        let num = m[1];
        const unit = m[2];
        const multipliers = { k: 1e3, m: 1e6, tr: 1e6, 'triệu': 1e6, trieu: 1e6, b: 1e9, 'tỷ': 1e9, ty: 1e9 };
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

    // ================= PRICING =================
    const calcTax = (cost, taxType) => {
        if (taxType === 'PIT') return Math.round(cost / 9);
        if (taxType === 'HKD') return Math.round(cost * 0.07);
        return 0;
    };
    /** Selling price from full cost. mode 'margin' = % of selling price; 'markup' = % on top of cost. */
    const priceFromCost = (fullCost, mode, pct) => {
        pct = Number(pct) || 0;
        if (mode === 'margin') return pct >= 100 ? 0 : Math.round(fullCost / (1 - pct / 100));
        return Math.round(fullCost * (1 + pct / 100));
    };
    /** Estimated price to the brand for one deliverable (backup not included: KPI unknown at matching time). */
    const estimatePrice = (koc, pricing = {}) => {
        const rate = numOr(koc.rate);
        if (!rate) return 0;
        const full = rate + calcTax(rate, koc.taxType || 'PIT');
        return priceFromCost(full, pricing.mode || 'margin', pricing.pct ?? 20);
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
     * ctx: { pricing: {mode,pct}, isBlacklisted(name) -> bool }
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
        if (ctx.isBlacklisted && ctx.isBlacklisted(koc.name)) excluded = 'Nằm trong blacklist';
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

    const COLUMN_ALIASES = {
        name: ['tên', 'ten', 'name', 'koc', 'kol', 'tên koc', 'tên kênh', 'kênh', 'creator'],
        platform: ['nền tảng', 'platform', 'mxh', 'mạng xã hội'],
        link: ['link', 'url', 'link kênh', 'profile'],
        contact: ['contact', 'liên hệ', 'sđt', 'sdt', 'zalo', 'phone', 'số điện thoại'],
        followers: ['followers', 'follower', 'follow', 'lượt theo dõi', 'người theo dõi', 'subs', 'subscribers'],
        avgViews: ['view tb', 'avg views', 'average views', 'view trung bình', 'lượt xem tb', 'views', 'view'],
        er: ['er', 'er (%)', 'engagement', 'engagement rate', 'tỷ lệ tương tác', 'tương tác'],
        categories: ['ngành', 'lĩnh vực', 'category', 'categories', 'chủ đề', 'niche', 'ngành hàng'],
        gender: ['giới tính khán giả', 'giới tính', 'gender', 'audience gender'],
        ages: ['độ tuổi khán giả', 'độ tuổi', 'age', 'ages', 'audience age'],
        location: ['khu vực', 'location', 'tỉnh', 'thành phố', 'vùng'],
        rate: ['giá nhập', 'giá', 'rate', 'cost', 'chi phí', 'báo giá', 'giá booking'],
        taxType: ['loại thuế', 'thuế', 'tax', 'tax type'],
        rating: ['đánh giá', 'rating', 'điểm'],
        notes: ['ghi chú', 'notes', 'note', 'mô tả', 'phong cách', 'style'],
    };
    const mapHeader = (h) => {
        const t = norm(h);
        for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) if (aliases.includes(t)) return field;
        for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) if (aliases.some(a => a.length > 3 && t.includes(a))) return field;
        return null;
    };

    /** Convert a raw row object (strings) into a clean KOC record. */
    const normalizeKoc = (r = {}) => {
        const cats = asArray(r.categories).flatMap(c => CATEGORIES.find(x => x.id === c) ? [c] : (CATEGORIES.find(x => norm(x.label) === norm(c)) ? [CATEGORIES.find(x => norm(x.label) === norm(c)).id] : detectCategories(c)));
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
            taxType: ['PIT', 'VAT', 'HKD'].includes(tax) ? tax : 'PIT',
            rating: Math.min(5, Math.max(0, numOr(r.rating))),
            notes: String(r.notes || '').trim(),
            tags: String(r.tags || '').trim(),
            status: r.status === 'inactive' ? 'inactive' : 'active',
            demo: !!r.demo,
            updatedAt: r.updatedAt || new Date().toISOString(),
        };
    };

    /** Parse pasted Excel/Sheets data or CSV text into KOC records. Returns { kocs, unknownHeaders, skipped }. */
    const importKocsFromText = (text) => {
        const rows = parseDelimited(text);
        if (rows.length < 2) return { kocs: [], unknownHeaders: [], skipped: rows.length, error: 'Cần có dòng tiêu đề và ít nhất 1 dòng dữ liệu' };
        const headers = rows[0].map(mapHeader);
        if (!headers.includes('name')) return { kocs: [], unknownHeaders: [], skipped: rows.length - 1, error: 'Không tìm thấy cột Tên (name)' };
        const unknownHeaders = rows[0].filter((h, i) => !headers[i] && String(h).trim());
        const kocs = [];
        let skipped = 0;
        rows.slice(1).forEach(cells => {
            const obj = {};
            headers.forEach((f, i) => { if (f && cells[i] !== undefined && obj[f] === undefined) obj[f] = cells[i]; });
            if (!String(obj.name || '').trim()) { skipped++; return; }
            kocs.push(normalizeKoc(obj));
        });
        return { kocs, unknownHeaders, skipped };
    };

    const EXPORT_COLUMNS = [
        ['name', 'Tên'], ['platform', 'Nền tảng'], ['link', 'Link'], ['contact', 'Contact'], ['followers', 'Followers'],
        ['avgViews', 'View TB'], ['er', 'ER (%)'], ['categories', 'Ngành'], ['gender', 'Giới tính khán giả'],
        ['ages', 'Độ tuổi khán giả'], ['location', 'Khu vực'], ['rate', 'Giá nhập'], ['taxType', 'Loại thuế'],
        ['rating', 'Đánh giá'], ['notes', 'Ghi chú'],
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

    return {
        CATEGORIES, PLATFORMS, TIERS, AGES, GENDERS, LOCATIONS, WEIGHTS,
        parseNumber, formatShort, formatFollowers, norm,
        calcTax, priceFromCost, estimatePrice,
        detectCategories, detectPlatforms, detectLocations, normalizePlatform, normalizeGender, normalizeAges, tierOf,
        parseBriefText, normalizeBrief, scoreKoc, rankKocs, pickShortlist,
        parseDelimited, importKocsFromText, normalizeKoc, exportKocsToCsv, EXPORT_COLUMNS,
    };
});
