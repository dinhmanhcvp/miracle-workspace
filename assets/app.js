'use strict';

// ================= CONSTANTS =================
const TABS = [
    { id: 'brief', name: 'Brief & Gợi ý KOC', icon: 'fa-wand-magic-sparkles', group: 'Tìm KOC' },
    { id: 'kocs', name: 'Kho KOC', icon: 'fa-address-book', group: 'Tìm KOC' },
    { id: 'scouting', name: 'Scouting & Xin Giá', icon: 'fa-search', group: 'Booking' },
    { id: 'internal', name: 'Proceed Internal', icon: 'fa-calculator', group: 'Booking' },
    { id: 'external', name: 'Proceed External', icon: 'fa-file-invoice-dollar', group: 'Booking' },
    { id: 'confirm', name: 'Confirm Booking', icon: 'fa-handshake', group: 'Booking' },
    { id: 'report', name: 'Weekly Report', icon: 'fa-chart-pie', group: 'Quản lý' },
    { id: 'db', name: 'Kho PNL & Báo cáo', icon: 'fa-database', group: 'Quản lý' },
];

const STORAGE = {
    pnl: 'miracle_pnls',
    reports: 'miracle_reports',
    apiKey: 'gemini_api_key_v2',
    model: 'miracle_gemini_model',
    blacklist: 'miracle_blacklist_custom',
    extMode: 'miracle_ext_mode',
    extPercent: 'miracle_ext_percent',
    agency: 'miracle_agency_name',
    blacklistMigrated: 'miracle_blacklist_migrated',
    kocs: 'miracle_kocs',
    brief: 'miracle_brief',
    shortlist: 'miracle_shortlist',
};
const DEFAULT_MODEL = 'gemini-2.5-flash';

// Blacklist that used to be hard-coded. It is moved once into the editable agency blacklist
// so existing users keep it, while new agencies start with an empty list.
const LEGACY_BLACKLIST = ["Hoàng Bảo Long", "muoibiennn ✿", "Chây Xì Dách", "Lang Thang Cần Thơ", "Sang Blu", "A ri é", "Thaomoon đi đâu đấy", "người đẹp té giếng", "Kenz Nguyễn", "Mr Xuân Hoàn", "Trang Rita", "Elmich"];

// Backup cost coefficient per KPI unit, by platform
const BACKUP_RATE = { TikTok: 3.5, FB: 35, YT: 35, Threads: 700 };

const INDUSTRY_HINTS = {
    'Momo/App': 'Ưu tiên KOL có tệp khán giả dễ cài app: kiểm tra chỉ số lượt cài, tỷ lệ giữ chân và khả năng truyền tải CTA rõ ràng.',
    'Game': 'Ưu tiên KOL thể hiện gameplay cuốn hút, có chỗ đặt link tải, tỷ lệ chuyển đổi người chơi và phong cách năng động / gaming.',
    'F&B': 'Ưu tiên chất lượng hình ảnh món ăn, review địa điểm thật, khả năng kéo khách tới cửa hàng và cách trình bày hấp dẫn.',
};

const FALLBACK_TEMPLATES = {
    scouting: [
        "Dạ chào anh/chị, mình là {soName} - Chuyên viên Booking của {agency}. Hiện tại bên mình đang tìm kiếm đối tác cho chiến dịch của nhãn hàng {brand}. Nhờ team check giúp mình chi phí cho hạng mục: {scope} với ngân sách dự kiến là {budget} nhé. Ngoài ra, để ưu tiên pass form với nhãn, mong team xem xét hỗ trợ thêm các quyền lợi: {focs}. Rất mong được hợp tác cùng kênh!",
        "Dạ chào team, mình là {soName} - Chuyên viên Booking của {agency}. Bên mình đang triển khai dự án cho {brand} và rất ấn tượng với nội dung của kênh. Nhờ team báo giá giúp mình cho hạng mục {scope} (ngân sách nhãn đang duyệt khoảng {budget}). Nếu được, team hỗ trợ giúp mình thêm các phần: {focs} để mình ưu tiên đẩy booking vào list chốt nhé ạ. Cảm ơn team!",
        "Dạ chào anh/chị, mình là {soName} - Chuyên viên Booking của {agency}. Hiện tại bên mình hợp tác với dự án thuộc nhãn hàng {brand}. Mình xin phép nhận báo giá từ kênh cho hạng mục: {scope}. Ngân sách nhãn đang đưa ra tối đa khoảng {budget}. Để hai bên dễ làm việc lâu dài, mong team có thể hỗ trợ giúp bên mình: {focs}. Mong sớm nhận được phản hồi từ team!"
    ],
    scoutingEn: [
        "Dear team,\n\nMy name is {soName}, Booking Specialist at {agency}. We are currently looking for partners for a campaign with {brand}. Could you kindly share your quotation for the following scope: {scope}? Our estimated budget is {budget}.\n\nWe would also greatly appreciate it if you could support the following: {focs}.\n\nLooking forward to working with you!"
    ],
    negotiating: [
        "Dạ team ơi, dự án này nhãn hàng có mức ngân sách khá fix, bên em trình duyệt được mức tối đa là {limitCost} cho hạng mục {scope}. Team xem hỗ trợ giúp em mức chi phí này để ưu tiên lên booking nhé. Qua camp này em sẽ ưu tiên đẩy kênh mình vào các job sau có budget tốt hơn ạ!",
        "Dạ team ơi, em có check data thì dạo này tương tác kênh mình bị xê dịch chút do thuật toán, nên nhãn hàng chỉ có thể cấp ngân sách tối đa {limitCost} cho {scope}. Anh/chị xem xét hỗ trợ bên em mức này để giữ nhịp hợp tác nhé, các dự án sau brand ngân sách thoáng hơn em sẽ báo liền ạ!",
        "Dạ em hiểu chi phí kênh đưa ra, nhưng đợt này nhãn họ siết budget gắt quá team ạ. Em cố gắng xin sếp lắm thì mức trần chỉ được {limitCost} cho {scope}. Mong team thông cảm và hỗ trợ em mức này để em chốt danh sách booking luôn. Em sẽ bù lại bằng việc ưu tiên kênh ở các dự án nhãn hàng lớn sắp tới của bên em nhé!"
    ],
    negotiatingEn: [
        "Dear team,\n\nThank you for your quotation. For this campaign, our client has a fixed budget, and the maximum we can propose for {scope} is {limitCost}. We would truly appreciate your support at this level, and we will prioritize your channel for upcoming campaigns with more flexible budgets.\n\nBest regards."
    ]
};

// ================= HELPERS =================
const $ = (id) => document.getElementById(id);

const safeStorage = {
    get(key, fallback = null) {
        try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
    },
    set(key, value) {
        try { localStorage.setItem(key, value); return true; } catch (e) { showToast('Không ghi được vào bộ nhớ trình duyệt: ' + e.message, 'error'); return false; }
    },
    remove(key) { try { localStorage.removeItem(key); } catch (e) { } },
    getJSON(key, fallback) {
        try { const v = JSON.parse(this.get(key, 'null')); return v === null ? fallback : v; } catch (e) { return fallback; }
    },
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Remove characters that would break a tab-separated Excel row
const cleanCell = (value) => String(value ?? '').replace(/[\t\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
const toTsvRow = (cells) => cells.map(cleanCell).join('\t');

// Shared with the matcher so both use exactly the same rules (see assets/matcher.js)
const parseNumber = KocMatcher.parseNumber;
const num = (value) => { const n = parseNumber(value); return isNaN(n) ? 0 : n; };

const formatMoney = (value) => {
    const n = Number(value);
    if (!isFinite(n) || n === 0) return '0';
    return Math.round(n).toLocaleString('vi-VN').replace(/,/g, '.');
};

const formatInputOnBlur = (e) => {
    const raw = e.target.value.trim();
    if (!raw) return;
    const n = parseNumber(raw);
    if (!isNaN(n)) e.target.value = formatMoney(n);
};

const normalizeName = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

// ================= STATE =================
let currentTabId = 'brief';
let savedPNL = safeStorage.getJSON(STORAGE.pnl, []);
let savedReports = safeStorage.getJSON(STORAGE.reports, []);
if (!Array.isArray(savedPNL)) savedPNL = [];
if (!Array.isArray(savedReports)) savedReports = [];

const persistPnl = () => safeStorage.set(STORAGE.pnl, JSON.stringify(savedPNL));
const persistReports = () => safeStorage.set(STORAGE.reports, JSON.stringify(savedReports));

// ================= UI: TOAST / NAV / MODALS =================
let showToast = (msg, type = 'success') => {
    const container = $('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    const color = type === 'success' ? 'bg-green-900/90 border-green-500' : type === 'error' ? 'bg-red-900/90 border-red-500' : 'bg-blue-900/90 border-blue-500';
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    el.className = `toast px-4 py-3 rounded-lg shadow-lg text-white font-medium flex items-center gap-2 border ${color}`;
    el.innerHTML = `<i class="fas ${icon}"></i> <span></span>`;
    el.querySelector('span').textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(100%)';
        setTimeout(() => el.remove(), 300);
    }, type === 'error' ? 5000 : 3000);
};

const renderSidebar = () => {
    let lastGroup = '';
    $('sidebar-nav').innerHTML = TABS.map(t => {
        const header = t.group !== lastGroup ? `<div class="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">${t.group}</div>` : '';
        lastGroup = t.group;
        return header + `
        <button onclick="switchTab('${t.id}')" id="btn-tab-${t.id}" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm text-gray-400 hover:bg-dark-800 hover:text-gray-200">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-dark-800 text-gray-500 transition-colors" id="icon-tab-${t.id}">
                <i class="fas ${t.icon}"></i>
            </div>
            ${t.name}
            ${t.id === 'db' ? '<span id="db-count" class="ml-auto text-xs bg-dark-700 text-gray-300 px-2 py-0.5 rounded-full">0</span>' : ''}
            ${t.id === 'kocs' ? '<span id="koc-count" class="ml-auto text-xs bg-dark-700 text-gray-300 px-2 py-0.5 rounded-full">0</span>' : ''}
        </button>`;
    }).join('');
    const agencyName = (safeStorage.get(STORAGE.agency, '') || '').trim();
    $('brand-title').textContent = agencyName || 'KOC Booking';
};

const toggleSidebar = (force) => {
    const sb = $('sidebar');
    const open = typeof force === 'boolean' ? force : sb.classList.contains('-translate-x-full');
    sb.classList.toggle('-translate-x-full', !open);
    $('sidebar-backdrop').classList.toggle('hidden', !open);
};

const switchTab = (id) => {
    if (!$(`tab-${id}`)) id = TABS[0].id;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    $(`tab-${id}`).classList.add('active');
    TABS.forEach(t => {
        const btn = $(`btn-tab-${t.id}`);
        const icon = $(`icon-tab-${t.id}`);
        const active = t.id === id;
        btn.classList.toggle('bg-brand-600/10', active);
        btn.classList.toggle('text-brand-500', active);
        btn.classList.toggle('text-gray-400', !active);
        icon.classList.toggle('bg-brand-500', active);
        icon.classList.toggle('text-white', active);
        icon.classList.toggle('bg-dark-800', !active);
        icon.classList.toggle('text-gray-500', !active);
    });
    currentTabId = id;
    refreshCalculations();
    toggleSidebar(false);
    if (typeof window.onTabShown === 'function') window.onTabShown(id);
    $('main-scroll')?.scrollTo(0, 0);
    try { history.replaceState(null, '', '#' + id); } catch (e) { }
};

const openModal = (name) => {
    if (name === 'settings') {
        $('gemini-api-key').value = safeStorage.get(STORAGE.apiKey, '');
        $('gemini-model').value = safeStorage.get(STORAGE.model, DEFAULT_MODEL);
        $('custom-blacklist').value = getCustomBlacklist().join('\n');
        $('agency-name').value = safeStorage.get(STORAGE.agency, '');
    }
    if (name === 'bookmarklet') setupBookmarklet();
    const m = $(`${name}-modal`);
    const p = $(`${name}-panel`);
    m.classList.remove('hidden');
    m.classList.add('flex');
    void m.offsetWidth; // force reflow so the transition runs
    m.classList.remove('opacity-0');
    p.classList.remove('scale-95');
};
const closeModal = (name) => {
    const m = $(`${name}-modal`);
    const p = $(`${name}-panel`);
    m.classList.add('opacity-0');
    p.classList.add('scale-95');
    setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 300);
};

const saveSettings = () => {
    const key = $('gemini-api-key').value.trim();
    const model = $('gemini-model').value.trim() || DEFAULT_MODEL;
    if (key) safeStorage.set(STORAGE.apiKey, key); else safeStorage.remove(STORAGE.apiKey);
    safeStorage.set(STORAGE.model, model);
    const list = $('custom-blacklist').value.split('\n').map(s => s.trim()).filter(Boolean);
    safeStorage.set(STORAGE.blacklist, JSON.stringify(list));
    safeStorage.set(STORAGE.agency, $('agency-name').value.trim());
    renderSidebar();
    switchTab(currentTabId);
    checkBlacklist();
    showToast('Đã lưu cài đặt');
    closeModal('settings');
};

// ================= BOOKMARKLET =================
const getToolUrl = () => location.href.split('#')[0].split('?')[0];

// The bookmarklet source lives in assets/grab.js (grabKocPage)
const buildBookmarkletCode = (toolUrl) => buildGrabBookmarklet(toolUrl);

const setupBookmarklet = () => {
    const url = getToolUrl();
    const code = buildBookmarkletCode(url);
    $('tool-url').value = url;
    $('bookmarklet-code').value = code;
    $('bookmarklet-link').setAttribute('href', code);
};

const PLATFORM_PATTERNS = [
    { value: 'TikTok', test: /tiktok\.com/ },
    { value: 'FB', test: /facebook\.com|fb\.watch|fb\.com/ },
    { value: 'YT', test: /youtube\.com|youtu\.be/ },
    { value: 'Threads', test: /threads\.(net|com)/ },
];
const detectPlatformFromLink = () => {
    const link = $('pnl-link').value.toLowerCase();
    const hit = PLATFORM_PATTERNS.find(p => p.test.test(link));
    if (hit && $('pnl-platform').value !== hit.value) {
        $('pnl-platform').value = hit.value;
        refreshCalculations();
    }
    return hit ? hit.value : null;
};

const loadFromUrlParams = () => {
    const params = new URLSearchParams(location.search);
    const name = params.get('name');
    const link = params.get('link');
    const followers = params.get('followers');
    if (!name && !link) return false;
    if (name) $('pnl-name').value = name;
    if (name) $('blacklist-input').value = name;
    if (link) {
        $('pnl-link').value = link;
        if (!detectPlatformFromLink() && /instagram\.com/.test(link.toLowerCase())) {
            showToast('Link Instagram: hãy tự chọn nền tảng phù hợp để tính phí backup.', 'info');
        }
    }
    if (followers) {
        const n = parseNumber(followers.replace(/followers?|người theo dõi/gi, ''));
        $('pnl-followers').value = isNaN(n) ? followers : String(Math.round(n));
    }
    // Clean URL so a refresh doesn't overwrite later edits
    try { history.replaceState(null, '', location.pathname + '#internal'); } catch (e) { }
    checkBlacklist();
    return true;
};

// ================= STEP 1 =================
const getCustomBlacklist = () => {
    const list = safeStorage.getJSON(STORAGE.blacklist, []);
    return Array.isArray(list) ? list : [];
};
const migrateLegacyData = () => {
    if (safeStorage.get(STORAGE.blacklistMigrated, null)) return;
    const hadLegacyData = safeStorage.get(STORAGE.pnl, null) !== null || safeStorage.get(STORAGE.apiKey, null) !== null || safeStorage.get(STORAGE.reports, null) !== null;
    if (hadLegacyData) {
        const merged = Array.from(new Set(getCustomBlacklist().concat(LEGACY_BLACKLIST)));
        safeStorage.set(STORAGE.blacklist, JSON.stringify(merged));
        if (!safeStorage.get(STORAGE.agency, '')) safeStorage.set(STORAGE.agency, 'The Miracle');
    }
    safeStorage.set(STORAGE.blacklistMigrated, '1');
};
const getAgencyName = () => (safeStorage.get(STORAGE.agency, '') || '').trim() || 'agency bên mình';
const getBlacklist = () => getCustomBlacklist().map(normalizeName).filter(Boolean);

/** Returns the matched blacklist entry, or null. */
const findBlacklisted = (name) => {
    const val = normalizeName(name);
    if (!val) return null;
    return getBlacklist().find(b => val === b || val.includes(b) || (val.length >= 4 && b.includes(val))) || null;
};

const checkBlacklist = () => {
    const val = $('blacklist-input').value;
    const match = findBlacklisted(val);
    $('blacklist-warning').classList.toggle('hidden', !match);
    $('blacklist-safe').classList.toggle('hidden', !!match || !val.trim());
    $('blacklist-match').textContent = match || '';
    return !!match;
};

const updateIndustryHint = () => {
    const val = $('industry-select').value;
    const h = $('industry-hint');
    h.classList.toggle('hidden', !INDUSTRY_HINTS[val]);
    h.innerHTML = INDUSTRY_HINTS[val] ? `<strong>Gợi ý:</strong> ${escapeHtml(INDUSTRY_HINTS[val])}` : '';
};

const getSelectedFocs = () => Array.from(document.querySelectorAll('#foc-container input:checked')).map(el => el.value);

const fillTemplate = (template, vars) => template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ================= AI =================
const callGemini = async (promptText) => {
    const key = safeStorage.get(STORAGE.apiKey, '');
    if (!key) throw new Error('NO_KEY');
    const model = safeStorage.get(STORAGE.model, DEFAULT_MODEL) || DEFAULT_MODEL;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { temperature: 0.7 }
        })
    });
    let data = {};
    try { data = await res.json(); } catch (e) { }
    if (!res.ok || data.error) {
        const msg = (data.error && data.error.message) || `HTTP ${res.status}`;
        if (res.status === 429 || /quota/i.test(msg)) throw new Error('QUOTA_EXCEEDED');
        if (res.status === 404) throw new Error(`Model "${model}" không tồn tại hoặc đã ngừng hỗ trợ. Đổi model trong Cài đặt.`);
        if (res.status === 400 && /api key/i.test(msg)) throw new Error('API Key không hợp lệ. Kiểm tra lại trong Cài đặt.');
        throw new Error(msg);
    }
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    if (!text) throw new Error('AI không trả về nội dung (có thể bị bộ lọc an toàn chặn).');
    return text;
};

/** Try Gemini; on any failure fall back to a built-in template so the user is never blocked. */
const generateWithFallback = async (prompt, fallbackFn) => {
    try {
        return { text: await callGemini(prompt), fromAI: true };
    } catch (err) {
        if (err.message === 'NO_KEY') showToast('Chưa có Gemini API Key: dùng văn mẫu có sẵn. Thêm key trong Cài đặt để dùng AI.', 'info');
        else if (err.message === 'QUOTA_EXCEEDED') showToast('API Key đã hết hạn mức: dùng văn mẫu có sẵn.', 'error');
        else showToast(`Lỗi AI: ${err.message}. Dùng văn mẫu có sẵn.`, 'error');
        return { text: fallbackFn(), fromAI: false };
    }
};

const renderMarkdown = (el, text) => {
    if (window.marked && window.DOMPurify) {
        el.innerHTML = DOMPurify.sanitize(marked.parse(text));
    } else {
        el.style.whiteSpace = 'pre-wrap';
        el.textContent = text;
    }
};

const setBusy = (btn, busy, label) => {
    btn.disabled = busy;
    btn.innerHTML = busy ? '<i class="fas fa-spinner fa-spin"></i> Đang soạn...' : label;
};

const generateXinGia = async () => {
    const so = $('so-name').value.trim();
    const brand = $('brand-name').value.trim();
    const scope = $('scope-xin-gia').value.trim();
    const bdg = $('budget').value.trim() || 'chưa xác định';
    if (!so || !brand || !scope) return showToast('Vui lòng điền Tên bạn, Brand và Hạng mục', 'error');

    const focChecks = getSelectedFocs();
    const agency = getAgencyName();
    const lang = $('lang-xingia').value;
    const selectedFOCs = focChecks.length ? focChecks.join(', ') : (lang === 'vi' ? 'Không có yêu cầu đặc biệt' : 'none');

    let prompt;
    if (lang === 'vi') {
        prompt = `Bạn là Chuyên viên Booking tại ${agency}. Viết tin nhắn xin báo giá gửi KOL. TUYỆT ĐỐI dùng tiếng Việt tự nhiên, lịch sự. KHÔNG dùng từ lóng (SO, FOC, Scope, Budget). Chỉ trả về nội dung tin nhắn, không giải thích. BẮT BUỘC MỞ ĐẦU: 'Dạ chào anh/chị, mình là ${so} - Chuyên viên Booking của ${agency}. Hiện tại bên mình đang tìm kiếm đối tác cho dự án của nhãn hàng ${brand}.' Hỏi chi phí cho ${scope} với ngân sách ${bdg}. Lồng ghép khéo léo yêu cầu các quyền lợi: ${selectedFOCs}.`;
    } else {
        prompt = `You are a Booking Specialist at the agency ${agency}. Write a professional business inquiry message to a foreign KOL. MUST use flawless English. DO NOT use acronyms (like SO, FOC). Return only the message.
IMPORTANT: The scope (${scope}) and requested supports (${selectedFOCs}) may be written in Vietnamese. Silently translate them into natural, professional Business English within the message.
MUST START WITH: 'Dear team, My name is ${so}, Booking Specialist at ${agency}. We are currently looking for partners for a campaign with ${brand}.' Ask for their quotation with an estimated budget of ${bdg}. Politely ask if they can provide the additional supports.`;
    }

    const btn = $('btn-xingia');
    const label = btn.innerHTML;
    setBusy(btn, true);
    const { text } = await generateWithFallback(prompt, () =>
        fillTemplate(pickRandom(lang === 'vi' ? FALLBACK_TEMPLATES.scouting : FALLBACK_TEMPLATES.scoutingEn),
            { soName: so, brand, scope, budget: bdg, focs: selectedFOCs, agency }));
    setBusy(btn, false, label);
    $('res-xingia-container').classList.remove('hidden');
    renderMarkdown($('res-xingia'), text);
};

// ================= STEP 2 + 3: PRICING =================
const computeDeal = () => {
    const cost = Math.max(0, num($('pnl-cost').value));
    const kpi = Math.max(0, num($('pnl-kpi').value));
    const plat = $('pnl-platform').value;
    const taxT = $('pnl-tax-type').value;

    const backup = Math.round(kpi * (BACKUP_RATE[plat] || 0));
    const tax = KocMatcher.calcTax(cost, taxT);

    const fullCost = cost + tax + backup;
    const mode = $('ext-mode').value;
    const pct = num($('ext-percent').value);
    let extCost = 0;
    let warning = '';
    if (mode === 'margin' && pct >= 100) warning = 'Margin phải nhỏ hơn 100%.';
    else extCost = KocMatcher.priceFromCost(fullCost, mode, pct);
    const grossProfit = extCost - fullCost;
    const marginPercent = extCost > 0 ? ((grossProfit / extCost) * 100).toFixed(2) + '%' : '0%';
    if (!warning && extCost > 0 && grossProfit <= 0) warning = 'Giá bán đang không có lãi.';

    return { cost, intCost: cost, kpi, plat, taxT, tax, backup, fullCost, mode, pct, extCost, grossProfit, marginPercent, warning };
};

// Kept for backward compatibility with old callers/tests
const calculatePnl = () => refreshCalculations();
const calculateExt = () => refreshCalculations().extCost;

const refreshCalculations = () => {
    const d = computeDeal();
    $('pnl-tax-calc').value = formatMoney(d.tax);
    $('pnl-backup').value = formatMoney(d.backup);
    $('pnl-full-cost').value = formatMoney(d.fullCost);
    $('ext-int-cost').value = d.cost ? `${formatMoney(d.fullCost)}  (Lương ${formatMoney(d.cost)} + Thuế ${formatMoney(d.tax)} + Backup ${formatMoney(d.backup)})` : 'Chưa nhập Lương KOL ở Bước 2';
    $('ext-ext-cost').value = formatMoney(d.extCost);
    $('ext-margin').value = formatMoney(d.grossProfit);
    $('ext-margin-pct').value = d.marginPercent;
    $('ext-warning').textContent = d.warning;
    $('ext-warning').classList.toggle('hidden', !d.warning);
    safeStorage.set(STORAGE.extMode, d.mode);
    safeStorage.set(STORAGE.extPercent, $('ext-percent').value);
    return d;
};

const buildPnlCells = (p, stt) => [
    stt,
    p.name,
    p.plat || '',
    p.link || '',
    p.followers || '',
    p.contact || '',
    p.fullScope || p.scope || '',
    formatMoney(p.extCost || 0),
    formatMoney(p.extCost || 0),
    1,
    'Video/ Bài',
    0,
    formatMoney(p.extCost || 0),
    formatMoney(p.intCost || p.cost || 0),
    1,
    formatMoney(p.intCost || p.cost || 0),
    formatMoney(p.tax || 0),
    formatMoney(p.backup || 0),
    formatMoney(p.grossProfit || 0),
    p.marginPercent || '0%',
    p.taxT || '',
    formatMoney(p.kpi || 0),
];

const getPnlRowData = () => {
    const d = computeDeal();
    const scopeText = $('pnl-scope').value.trim();
    const focChecks = getSelectedFocs();
    const fullScope = scopeText + (focChecks.length ? (scopeText ? ' + ' : '') + 'FOC: ' + focChecks.join(', ') : '');
    const row = {
        name: $('pnl-name').value.trim(),
        plat: d.plat,
        link: $('pnl-link').value.trim(),
        followers: $('pnl-followers').value.trim(),
        contact: $('pnl-contact').value.trim(),
        fullScope,
        extCost: d.extCost,
        intCost: d.intCost,
        tax: d.tax,
        taxT: d.taxT,
        backup: d.backup,
        kpi: d.kpi,
        grossProfit: d.grossProfit,
        marginPercent: d.marginPercent,
        savedAt: new Date().toISOString(),
    };
    row.rawString = toTsvRow(buildPnlCells(row, 1));
    return row;
};

const exportPnl = () => {
    const data = getPnlRowData();
    if (!data.intCost) return showToast('Chưa nhập Lương KOL', 'error');
    copyTextToClipboard(data.rawString);
};

const savePnlToDb = () => {
    const data = getPnlRowData();
    if (!data.name || !data.intCost) return showToast('Cần nhập Tên KOL và Lương KOL', 'error');
    if (findBlacklisted(data.name) && !confirm(`"${data.name}" nằm trong blacklist. Vẫn lưu?`)) return;
    const dup = savedPNL.findIndex(p => normalizeName(p.name) === normalizeName(data.name) && (p.link || '') === data.link);
    if (dup > -1) {
        if (!confirm(`"${data.name}" đã có trong kho. Ghi đè bản cũ?`)) return;
        savedPNL[dup] = data;
    } else {
        savedPNL.push(data);
    }
    persistPnl();
    renderDbTables();
    showToast(`Đã lưu "${data.name}" vào kho PNL (${savedPNL.length} dòng)`);
};

const exportExternal = () => {
    const d = computeDeal();
    if (!d.extCost) return showToast('Chưa có giá bán. Nhập Lương KOL ở Bước 2.', 'error');
    // Name | Scope | Unit price | Unit | Qty | Discount | Total
    const rowStr = toTsvRow([$('pnl-name').value, $('pnl-scope').value, formatMoney(d.extCost), 'Video/ Bài', 1, 0, formatMoney(d.extCost)]);
    copyTextToClipboard(rowStr);
};

// ================= STEP 4 =================
const generateDealCast = async () => {
    const limitRaw = $('deal-limit').value.trim();
    if (!limitRaw) return showToast('Vui lòng nhập giá mục tiêu', 'error');
    const limitNum = parseNumber(limitRaw);
    const limit = isNaN(limitNum) ? limitRaw : formatMoney(limitNum) + 'đ';
    const lang = $('lang-dealcast').value;
    const scope = cleanCell($('pnl-scope').value) || (lang === 'vi' ? 'các hạng mục bàn giao' : 'the agreed deliverables');

    let prompt;
    if (lang === 'vi') {
        prompt = `Bạn là Chuyên viên Booking. Viết tin nhắn đàm phán giảm chi phí booking KOL xuống mức ${limit} cho hạng mục: ${scope}. Dùng thuần tiếng Việt, lịch sự. KHÔNG dùng từ lóng (Deal cast, Margin). Đưa ra lý do khách quan (thuật toán, nhãn hàng siết ngân sách) để thuyết phục. Mềm mỏng nhưng kiên quyết, hứa ưu tiên kênh ở dự án sau. Chỉ trả về nội dung tin nhắn.`;
    } else {
        prompt = `You are a Booking Specialist. Write a professional negotiation message asking a KOL to reduce their quotation to ${limit} for: ${scope} (translate to English if written in Vietnamese). Use flawless English. Justify with objective reasons such as strict client budgets or recent engagement changes, phrased very politely. Be understanding but firm, and suggest future collaborations to compensate. Return only the message.`;
    }

    const btn = $('btn-dealcast');
    const label = btn.innerHTML;
    setBusy(btn, true);
    const { text } = await generateWithFallback(prompt, () =>
        fillTemplate(pickRandom(lang === 'vi' ? FALLBACK_TEMPLATES.negotiating : FALLBACK_TEMPLATES.negotiatingEn), { limitCost: limit, scope }));
    setBusy(btn, false, label);
    $('res-dealcast-container').classList.remove('hidden');
    renderMarkdown($('res-dealcast'), text);
};

// ================= CLIPBOARD =================
let copyTextToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
    } catch (e) {
        const t = document.createElement('textarea');
        t.value = text;
        t.style.position = 'fixed';
        t.style.opacity = '0';
        document.body.appendChild(t);
        t.select();
        try { document.execCommand('copy'); } catch (e2) { showToast('Trình duyệt chặn copy. Hãy copy thủ công.', 'error'); t.remove(); return; }
        t.remove();
    }
    showToast('Đã copy vào clipboard!');
};
const copyHTMLContent = (id) => copyTextToClipboard(($(id).innerText || $(id).textContent).trim());
const copyInput = (id) => copyTextToClipboard($(id).value);

// ================= STEP 5 =================
const getReportData = () => {
    const r = {
        client: cleanCell($('rep-client').value),
        camp: cleanCell($('rep-campaign').value),
        status: cleanCell($('rep-status').value),
        result: cleanCell($('rep-result').value),
        error: cleanCell($('rep-error').value),
    };
    // Client | Campaign | Status | (blank) | (blank) | Kết quả | Lỗi sai
    r.rawString = [r.client, r.camp, r.status, '', '', r.result, r.error].join('\t');
    r.savedAt = new Date().toISOString();
    return r;
};
const exportReport = () => copyTextToClipboard(getReportData().rawString);
const saveReportToDb = () => {
    const r = getReportData();
    if (!r.client || !r.camp) return showToast('Cần nhập Client và Campaign', 'error');
    savedReports.push(r);
    persistReports();
    renderDbTables();
    showToast('Đã lưu báo cáo vào kho');
};

// ================= STEP 6 (LOCAL DB) =================
const STATUS_STYLE = {
    'Đã chốt': 'bg-green-900/40 text-green-400',
    'DONE': 'bg-green-900/40 text-green-400',
    'Hủy': 'bg-red-900/40 text-red-400',
};

const renderDbTables = () => {
    const pBody = $('pnl-tbody');
    if (!savedPNL.length) {
        pBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 italic py-4">Chưa có dữ liệu PNL.</td></tr>';
    } else {
        pBody.innerHTML = savedPNL.map((p, i) => `<tr>
            <td class="text-gray-500">${i + 1}</td>
            <td>${escapeHtml(p.name)}${findBlacklisted(p.name) ? ' <i class="fas fa-exclamation-triangle text-red-500" title="Blacklist"></i>' : ''}</td>
            <td>${escapeHtml(p.plat || '-')}</td>
            <td class="text-brand-400 whitespace-nowrap">${formatMoney(p.intCost || p.cost || 0)}</td>
            <td class="text-green-400 whitespace-nowrap">${formatMoney(p.extCost || 0)}</td>
            <td class="whitespace-nowrap">${formatMoney(p.grossProfit || 0)} <span class="text-xs text-gray-500">${escapeHtml(p.marginPercent || '')}</span></td>
            <td class="text-right"><button onclick="deleteRow('pnl', ${i})" class="text-gray-500 hover:text-red-500" title="Xóa dòng"><i class="fas fa-times"></i></button></td>
        </tr>`).join('');
    }
    const totalRevenue = savedPNL.reduce((s, p) => s + (Number(p.extCost) || 0), 0);
    const totalMargin = savedPNL.reduce((s, p) => s + (Number(p.grossProfit) || 0), 0);
    $('stat-total-koc').textContent = savedPNL.length;
    $('stat-total-revenue').textContent = formatMoney(totalRevenue) + ' ₫';
    $('stat-total-margin').textContent = formatMoney(totalMargin) + ' ₫';
    $('stat-avg-margin').textContent = totalRevenue > 0 ? `Margin trung bình: ${(totalMargin / totalRevenue * 100).toFixed(2)}%` : '';

    const rBody = $('reports-tbody');
    if (!savedReports.length) {
        rBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 italic py-4">Chưa có dữ liệu báo cáo.</td></tr>';
    } else {
        rBody.innerHTML = savedReports.map((r, i) => `<tr>
            <td>${escapeHtml(r.client)}</td>
            <td>${escapeHtml(r.camp)}</td>
            <td><span class="px-2 py-1 rounded-full text-xs whitespace-nowrap ${STATUS_STYLE[r.status] || 'bg-yellow-900/40 text-yellow-400'}">${escapeHtml(r.status)}</span></td>
            <td class="truncate max-w-xs" title="${escapeHtml(r.result)}">${escapeHtml(r.result)}</td>
            <td class="text-right"><button onclick="deleteRow('reports', ${i})" class="text-gray-500 hover:text-red-500" title="Xóa dòng"><i class="fas fa-times"></i></button></td>
        </tr>`).join('');
    }
    const badge = $('db-count');
    if (badge) badge.textContent = savedPNL.length + savedReports.length;
};

const deleteRow = (type, index) => {
    const list = type === 'pnl' ? savedPNL : savedReports;
    const label = type === 'pnl' ? list[index]?.name : `${list[index]?.client} / ${list[index]?.camp}`;
    if (!confirm(`Xóa dòng "${label}"?`)) return;
    list.splice(index, 1);
    type === 'pnl' ? persistPnl() : persistReports();
    renderDbTables();
};

const copyBulkPnl = () => {
    if (!savedPNL.length) return showToast('Chưa có dữ liệu để copy', 'error');
    const rows = savedPNL.map((p, i) => toTsvRow(buildPnlCells(p, i + 1)));
    copyTextToClipboard(rows.join('\n'));
    showToast(`Đã copy ${savedPNL.length} dòng PRE PNL (22 cột)`);
};

const copyBulkReports = () => {
    if (!savedReports.length) return showToast('Chưa có dữ liệu để copy', 'error');
    const rows = savedReports.map(r => [r.client, r.camp, r.status, '', '', r.result, r.error].map(cleanCell).join('\t'));
    copyTextToClipboard(rows.join('\n'));
    showToast(`Đã copy ${savedReports.length} dòng báo cáo`);
};

const clearDb = (type) => {
    if (!confirm(`Xóa TOÀN BỘ ${type === 'pnl' ? 'PNL' : 'báo cáo tuần'} đã lưu? Không thể hoàn tác (nên Sao lưu trước).`)) return;
    if (type === 'pnl') { savedPNL = []; safeStorage.remove(STORAGE.pnl); }
    else { savedReports = []; safeStorage.remove(STORAGE.reports); }
    renderDbTables();
    showToast('Đã xóa dữ liệu');
};

const exportBackup = () => {
    const payload = { app: 'miracle-workspace', version: 2, exportedAt: new Date().toISOString(), pnl: savedPNL, reports: savedReports, blacklist: getCustomBlacklist() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `miracle-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
};

const importBackup = (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (!Array.isArray(data.pnl) || !Array.isArray(data.reports)) throw new Error('File không đúng định dạng');
            const replace = confirm(`File có ${data.pnl.length} PNL và ${data.reports.length} báo cáo.\nOK = THAY THẾ dữ liệu hiện tại\nCancel = GỘP thêm vào`);
            savedPNL = replace ? data.pnl : savedPNL.concat(data.pnl);
            savedReports = replace ? data.reports : savedReports.concat(data.reports);
            if (Array.isArray(data.blacklist)) {
                const merged = Array.from(new Set(getCustomBlacklist().concat(data.blacklist)));
                safeStorage.set(STORAGE.blacklist, JSON.stringify(merged));
            }
            persistPnl();
            persistReports();
            renderDbTables();
            showToast('Khôi phục dữ liệu thành công');
        } catch (e) {
            showToast('Không đọc được file sao lưu: ' + e.message, 'error');
        }
    };
    reader.readAsText(file);
};

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
    migrateLegacyData();
    renderSidebar();

    const savedMode = safeStorage.get(STORAGE.extMode, null);
    const savedPct = safeStorage.get(STORAGE.extPercent, null);
    if (savedMode === 'margin' || savedMode === 'markup') $('ext-mode').value = savedMode;
    if (savedPct !== null && savedPct !== '') $('ext-percent').value = savedPct;

    document.querySelectorAll('.money-input').forEach(el => el.addEventListener('blur', (e) => { formatInputOnBlur(e); refreshCalculations(); }));
    $('pnl-followers').addEventListener('blur', (e) => {
        const n = parseNumber(e.target.value);
        if (!isNaN(n)) e.target.value = String(Math.round(n));
    });

    renderDbTables();
    const fromBookmarklet = loadFromUrlParams();
    const legacyHash = { '#step-1': 'scouting', '#step-2': 'internal', '#step-3': 'external', '#step-4': 'confirm', '#step-5': 'report', '#step-6': 'db' };
    const hashTab = legacyHash[location.hash] || location.hash.slice(1);
    switchTab(fromBookmarklet ? 'internal' : (hashTab || TABS[0].id));
    if (fromBookmarklet) {
        setTimeout(() => showToast(checkBlacklist() ? '⚠️ KOC này nằm trong BLACKLIST!' : 'Đã tải dữ liệu KOC từ Bookmarklet', checkBlacklist() ? 'error' : 'success'), 400);
    }
    if (!safeStorage.get(STORAGE.apiKey, '')) {
        setTimeout(() => showToast('Chưa có Gemini API Key. Các nút AI sẽ dùng văn mẫu. Thêm key trong Cài đặt.', 'info'), 800);
    }
});

// ================= AUTOMATED TESTS =================
// Safe to run on real data: all form values, storage and DB state are snapshotted and restored.
window.runAutomatedTests = async ({ silent = false } = {}) => {
    console.log('=== STARTING AUTOMATED TEST SUITE ===');
    const results = [];
    const assert = (condition, name, message) => {
        results.push({ name, pass: !!condition, message });
        if (condition) console.log(`✅ PASS: ${name}`); else console.error(`❌ FAIL: ${name} - ${message}`);
    };

    // ---- Snapshot ----
    const fields = Array.from(document.querySelectorAll('input[id], select[id], textarea[id]')).filter(el => el.type !== 'file');
    const fieldSnap = fields.map(el => [el, el.type === 'checkbox' ? el.checked : el.value]);
    const focSnap = Array.from(document.querySelectorAll('#foc-container input')).map(el => [el, el.checked]);
    const storageSnap = Object.values(STORAGE).map(k => [k, safeStorage.get(k, null)]);
    const pnlSnap = savedPNL;
    const repSnap = savedReports;
    const originalCopier = copyTextToClipboard;
    const originalFetch = window.fetch;
    const originalConfirm = window.confirm;
    const originalToast = showToast;
    let clipboardMemory = '';
    copyTextToClipboard = async (text) => { clipboardMemory = text; };
    window.confirm = () => true;
    savedPNL = [];
    savedReports = [];
    const set = (id, v) => { $(id).value = v; };

    try {
        // TEST 1: Blacklist
        safeStorage.set(STORAGE.blacklist, JSON.stringify(['Sang Blu', 'Kenz Nguyễn']));
        safeStorage.set(STORAGE.agency, 'The Miracle');
        set('blacklist-input', 'Sang Blu');
        assert(checkBlacklist(), 'T1A Blacklist hit', 'Sang Blu should be warned');
        set('blacklist-input', 'Tiến Mạnh');
        assert(!checkBlacklist(), 'T1B Blacklist miss', 'Tiến Mạnh should be safe');
        set('blacklist-input', 'a');
        assert(!checkBlacklist(), 'T1C No false positive on short input', '"a" should not match');
        set('blacklist-input', '  SANG   BLU review ');
        assert(checkBlacklist(), 'T1D Case/space insensitive', 'should match normalized name');

        // TEST 2: Number parsing
        assert(parseNumber('10.000.000') === 10000000, 'T2A parse 10.000.000', String(parseNumber('10.000.000')));
        assert(parseNumber('120k') === 120000, 'T2B parse 120k', String(parseNumber('120k')));
        assert(parseNumber('1,2M') === 1200000, 'T2C parse 1,2M', String(parseNumber('1,2M')));
        assert(parseNumber('3tr') === 3000000, 'T2D parse 3tr', String(parseNumber('3tr')));
        assert(parseNumber('1.5K') === 1500, 'T2E parse 1.5K', String(parseNumber('1.5K')));
        assert(isNaN(parseNumber('abc')), 'T2F parse invalid', 'should be NaN');

        // TEST 3: TikTok & HKD
        set('pnl-platform', 'TikTok'); set('pnl-tax-type', 'HKD'); set('pnl-cost', '10000000'); set('pnl-kpi', '200000');
        let d = computeDeal();
        assert(d.backup === 700000, 'T3A Backup TikTok', d.backup);
        assert(d.tax === 700000, 'T3B Tax HKD', d.tax);
        exportPnl();
        assert(clipboardMemory.includes('10.000.000'), 'T3C Money format', clipboardMemory);
        assert(clipboardMemory.split('\t').length === 22, 'T3D 22 columns', clipboardMemory.split('\t').length);

        // TEST 4: FB & PIT
        set('pnl-platform', 'FB'); set('pnl-tax-type', 'PIT'); set('pnl-cost', '9.000.000'); set('pnl-kpi', '2000');
        d = computeDeal();
        assert(d.backup === 70000, 'T4A Backup FB', d.backup);
        assert(d.tax === 1000000, 'T4B Tax PIT', d.tax);

        // TEST 5: Pricing modes
        set('pnl-tax-type', 'VAT'); set('pnl-cost', '10000000'); set('pnl-kpi', '0');
        set('ext-mode', 'markup'); set('ext-percent', '20');
        d = computeDeal();
        assert(d.extCost === 12000000, 'T5A Markup 20%', d.extCost);
        set('ext-mode', 'margin');
        d = refreshCalculations();
        assert(d.extCost === 12500000, 'T5B Margin 20%', d.extCost);
        assert(d.marginPercent === '20.00%', 'T5C Real margin equals target', d.marginPercent);
        assert($('ext-margin').value === '2.500.000', 'T5D Margin field', $('ext-margin').value);
        set('pnl-tax-type', 'PIT'); set('pnl-kpi', '2000');
        d = computeDeal();
        assert(d.marginPercent === '20.00%' && d.grossProfit === d.extCost - d.cost - d.tax - d.backup, 'T5E Margin includes tax & backup', d.marginPercent);
        set('ext-percent', '100');
        assert(computeDeal().warning !== '', 'T5F Margin 100% rejected', 'should warn');
        set('ext-percent', '20');
        set('pnl-name', 'KOL A'); set('pnl-scope', '1 clip\n60s\tTikTok');
        exportExternal();
        assert(clipboardMemory.split('\t').length === 7 && !clipboardMemory.includes('\n'), 'T5G External row sanitized', JSON.stringify(clipboardMemory));

        // TEST 6: AI prompt + fallback
        document.querySelectorAll('#foc-container input').forEach(el => el.checked = false);
        const focBoxes = Array.from(document.querySelectorAll('#foc-container input'));
        focBoxes[0].checked = true; focBoxes[1].checked = true;
        set('budget', '3.000.000'); set('so-name', 'Tester'); set('brand-name', 'BrandX'); set('scope-xin-gia', '1 Clip'); set('lang-xingia', 'vi');
        let capturedPrompt = '', capturedHeaders = {}, capturedUrl = '';
        window.fetch = async (url, opts) => {
            capturedUrl = url; capturedHeaders = opts.headers;
            capturedPrompt = JSON.parse(opts.body).contents[0].parts[0].text;
            return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Mock LLM Response' }] } }] }) };
        };
        safeStorage.set(STORAGE.apiKey, 'test_key');
        safeStorage.set(STORAGE.model, DEFAULT_MODEL);
        await generateXinGia();
        assert(capturedPrompt.includes("Dạ chào anh/chị, mình là Tester - Chuyên viên Booking của The Miracle. Hiện tại bên mình đang tìm kiếm đối tác cho dự án của nhãn hàng BrandX."), 'T6A Mandatory opening', capturedPrompt);
        assert(capturedPrompt.includes('Miễn phí cung cấp mã Code Ads 7 ngày (Bắt buộc TikTok)') && capturedPrompt.includes('Miễn phí SDHA 1 tháng'), 'T6B FOCs in prompt', capturedPrompt);
        assert(!capturedUrl.includes('test_key') && capturedHeaders['x-goog-api-key'] === 'test_key', 'T6C API key sent in header, not URL', capturedUrl);
        assert($('res-xingia').textContent.includes('Mock LLM Response'), 'T6D Response rendered', $('res-xingia').textContent);

        showToast = () => { };
        window.fetch = async () => ({ ok: false, status: 404, json: async () => ({ error: { message: 'model not found' } }) });
        await generateXinGia();
        assert($('res-xingia').textContent.includes('Tester') && $('res-xingia').textContent.includes('BrandX'), 'T6E Fallback template on API error', $('res-xingia').textContent);
        safeStorage.remove(STORAGE.apiKey);
        set('deal-limit', '5tr');
        await generateDealCast();
        assert($('res-dealcast').textContent.includes('5.000.000'), 'T6F Deal cast fallback without key', $('res-dealcast').textContent);
        window.fetch = async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '<img src=x onerror="window.__xss=1">Hi' }] } }] }) });
        safeStorage.set(STORAGE.apiKey, 'test_key');
        await generateXinGia();
        assert(!$('res-xingia').querySelector('img[onerror]'), 'T6G AI output sanitized', $('res-xingia').innerHTML);
        showToast = originalToast;

        // TEST 7: Weekly report
        set('rep-client', 'Client X'); set('rep-campaign', 'Summer Sales'); set('rep-status', 'Đang đàm phán');
        set('rep-result', 'Line 1\nLine 2'); set('rep-error', 'No\terror');
        exportReport();
        assert(clipboardMemory.startsWith('Client X\tSummer Sales\tĐang đàm phán'), 'T7A Report row', clipboardMemory);
        assert(!clipboardMemory.includes('\n') && clipboardMemory.split('\t').length === 7, 'T7B Report sanitized', JSON.stringify(clipboardMemory));

        // TEST 8: Local DB (isolated from real data)
        set('pnl-name', 'Mock KOL 1'); set('pnl-link', 'Link 1'); set('pnl-followers', '100k'); set('pnl-platform', 'FB'); set('pnl-cost', '1000000'); set('pnl-kpi', '50000'); set('pnl-scope', 'line1\nline2');
        savePnlToDb();
        set('pnl-name', '<b onmouseover=alert(1)>Mock KOL 2</b>'); set('pnl-link', 'Link 2'); set('pnl-platform', 'TikTok'); set('pnl-cost', '5000000'); set('pnl-kpi', '150000');
        savePnlToDb();
        assert(savedPNL.length === 2, 'T8A Saved 2 rows', savedPNL.length);
        set('pnl-name', 'Mock KOL 1'); set('pnl-link', 'Link 1');
        savePnlToDb();
        assert(savedPNL.length === 2, 'T8B Duplicate overwritten, not appended', savedPNL.length);
        copyBulkPnl();
        const bulkRows = clipboardMemory.split('\n');
        assert(bulkRows.length === 2 && bulkRows.every(r => r.split('\t').length === 22), 'T8C Bulk copy 2 rows × 22 cols', JSON.stringify(bulkRows));
        assert(bulkRows[0].startsWith('1\tMock KOL 1') && bulkRows[1].startsWith('2\t'), 'T8D STT numbering', bulkRows[0]);
        assert(!$('pnl-tbody').querySelector('b'), 'T8E Names escaped in table', $('pnl-tbody').innerHTML);
        assert(pnlSnap !== savedPNL, 'T8F Real data untouched', 'snapshot replaced');
    } catch (e) {
        console.error('Test execution encountered an unexpected error:', e);
        results.push({ name: 'Unexpected error', pass: false, message: e.message });
    } finally {
        // ---- Restore ----
        copyTextToClipboard = originalCopier;
        window.fetch = originalFetch;
        window.confirm = originalConfirm;
        showToast = originalToast;
        savedPNL = pnlSnap;
        savedReports = repSnap;
        storageSnap.forEach(([k, v]) => { if (v === null) safeStorage.remove(k); else safeStorage.set(k, v); });
        fieldSnap.forEach(([el, v]) => { if (el.type === 'checkbox') el.checked = v; else el.value = v; });
        focSnap.forEach(([el, v]) => { el.checked = v; });
        $('res-xingia-container').classList.add('hidden');
        $('res-dealcast-container').classList.add('hidden');
        checkBlacklist();
        refreshCalculations();
        renderDbTables();
    }

    const passed = results.filter(r => r.pass).length;
    const failed = results.length - passed;
    console.log(`=== TESTS COMPLETE: ${passed} passed, ${failed} failed ===`);
    if (!silent) alert(`Kiểm thử hoàn tất!\n✅ Đạt: ${passed}\n❌ Lỗi: ${failed}${failed ? '\n\n' + results.filter(r => !r.pass).map(r => r.name).join('\n') : ''}\n\n(Dữ liệu của bạn không bị thay đổi.)`);
    return { passed, failed, results };
};
