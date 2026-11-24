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
    { id: 'config', name: 'Cấu hình agency', icon: 'fa-sliders', group: 'Quản lý' },
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
    kocs: 'miracle_kocs',
    agencyConfig: 'miracle_agency_config',
    trial: 'miracle_trial_start',
    blacklistV2: 'miracle_blacklist_v2',
    pricing: 'miracle_pricing_v2',
    sync: 'miracle_sync_config',
    syncState: 'miracle_sync_state',
    brief: 'miracle_brief',
    shortlist: 'miracle_shortlist',
};
const DEFAULT_MODEL = 'gemini-2.5-flash';



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

// ---- Team helpers ----
const currentUser = () => ((safeStorage.getJSON(STORAGE.sync, null) || {}).user || '').trim();
/** Personal Gemini key, or the team key the lead set in Cấu hình agency. */
const getApiKey = () => safeStorage.get(STORAGE.apiKey, '') || (typeof getAgencyConfig === 'function' ? (getAgencyConfig().teamApiKey || '') : '');
/** Who created a record and when (shown in the team dashboard). */
const stampNew = (r) => ({ ...r, createdAt: r.createdAt || new Date().toISOString(), createdBy: r.createdBy !== undefined ? r.createdBy : currentUser() });

// Lead PIN: stops members from changing agency formulas or wiping shared data by mistake (not a security boundary)
const LEAD_SESSION = 'miracle_lead_unlocked';
const hashPin = (pin, salt) => {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    const str = `${salt}:${pin}`;
    for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
};
const leadPinSet = () => typeof getAgencyConfig === 'function' && !!getAgencyConfig().leadPinHash;
const isLeadUnlocked = () => {
    if (!leadPinSet()) return true;
    try { return sessionStorage.getItem(LEAD_SESSION) === getAgencyConfig().leadPinHash; } catch (e) { return false; }
};
/** Ask for the lead PIN when one is set. Returns true when the action may continue. */
const requireLead = (what) => {
    if (isLeadUnlocked()) return true;
    const pin = window.prompt(`Chỉ trưởng nhóm được ${what}. Nhập mã trưởng nhóm:`);
    if (pin === null) return false;
    const cfg = getAgencyConfig();
    if (hashPin(pin.trim(), cfg.leadPinSalt) !== cfg.leadPinHash) { showToast('Sai mã trưởng nhóm', 'error'); return false; }
    try { sessionStorage.setItem(LEAD_SESSION, cfg.leadPinHash); } catch (e) { }
    return true;
};

const normalizeName = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

// ================= STATE =================
let currentTabId = 'brief';
let savedPNL = safeStorage.getJSON(STORAGE.pnl, []);
let savedReports = safeStorage.getJSON(STORAGE.reports, []);
if (!Array.isArray(savedPNL)) savedPNL = [];
if (!Array.isArray(savedReports)) savedReports = [];
const withId = (prefix) => (r) => (r && !r.id ? { ...r, id: prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) } : r);

const persistPnl = ({ track = true } = {}) => { safeStorage.set(STORAGE.pnl, JSON.stringify(savedPNL)); if (track && window.Sync) Sync.changed('pnl'); };
const persistReports = ({ track = true } = {}) => { safeStorage.set(STORAGE.reports, JSON.stringify(savedReports)); if (track && window.Sync) Sync.changed('reports'); };

// ================= UI: TOAST / NAV / MODALS =================
let showToast = (msg, type = 'success') => {
    const container = $('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    const color = type === 'success' ? 'bg-green-900/90 border-green-500' : type === 'error' ? 'bg-red-900/90 border-red-500' : 'bg-blue-900/90 border-blue-500';
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    el.className = `toast px-3 py-2 rounded-lg shadow-lg text-white text-sm flex items-center gap-2 border ${color}`;
    while (container.children.length >= 3) container.firstElementChild.remove(); // keep at most 3 on screen
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
    $('brand-title').textContent = rawAgencyName() || 'KOC Booking';
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
    if (id === 'config' && typeof renderConfigTab === 'function') renderConfigTab();
    if (typeof window.onTabShown === 'function') window.onTabShown(id);
    $('main-scroll')?.scrollTo(0, 0);
    try { history.replaceState(null, '', '#' + id); } catch (e) { }
};

const openModal = (name) => {
    if (name === 'settings') {
        $('gemini-api-key').value = safeStorage.get(STORAGE.apiKey, '');
        $('gemini-model').value = safeStorage.get(STORAGE.model, DEFAULT_MODEL);
        if (window.Sync) Sync.fillSettings();
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
    // only hide if it was not reopened during the fade-out
    setTimeout(() => { if (m.classList.contains('opacity-0')) { m.classList.add('hidden'); m.classList.remove('flex'); } }, 300);
};

const saveSettings = () => {
    const key = $('gemini-api-key').value.trim();
    const model = $('gemini-model').value.trim() || DEFAULT_MODEL;
    if (key) safeStorage.set(STORAGE.apiKey, key); else safeStorage.remove(STORAGE.apiKey);
    safeStorage.set(STORAGE.model, model);
    if (window.Sync) Sync.saveSettings();
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
const rawAgencyName = () => ((typeof getAgencyConfig === 'function' ? getAgencyConfig().agencyName : '') || safeStorage.get(STORAGE.agency, '') || '').trim();
const getAgencyName = () => rawAgencyName() || 'agency bên mình';
// Blacklist entries: { id, name, link, project, reason, updatedAt }
let blacklistCache = null;
const getBlacklistEntries = () => {
    if (blacklistCache) return blacklistCache;
    let list = safeStorage.getJSON(STORAGE.blacklistV2, null);
    if (!Array.isArray(list)) {
        // migrate the old name-only list
        list = getCustomBlacklist().map(name => KocMatcher.normalizeBlacklistEntry({ name }));
        safeStorage.set(STORAGE.blacklistV2, JSON.stringify(list));
    }
    blacklistCache = list;
    return list;
};
const setBlacklistEntries = (list, { track = true } = {}) => {
    blacklistCache = list;
    safeStorage.set(STORAGE.blacklistV2, JSON.stringify(list));
    if (track && window.Sync) Sync.changed('blacklist');
};

/** Returns the matching blacklist entry (by name or by channel link), or null. */
const findBlacklistEntry = (name, link) => {
    const val = normalizeName(name);
    const handle = KocMatcher.handleFromLink(link);
    return getBlacklistEntries().find(e => {
        if (handle && e.link && KocMatcher.handleFromLink(e.link) === handle) return true;
        const b = normalizeName(e.name);
        if (!val || !b) return false;
        return val === b || val.includes(b) || (val.length >= 4 && b.includes(val));
    }) || null;
};
const findBlacklisted = (name, link) => { const e = findBlacklistEntry(name, link); return e ? (e.name || e.link) : null; };

const checkBlacklist = () => {
    const val = $('blacklist-input').value;
    const entry = findBlacklistEntry(val, /^https?:/.test(val.trim()) ? val.trim() : '');
    $('blacklist-warning').classList.toggle('hidden', !entry);
    $('blacklist-safe').classList.toggle('hidden', !!entry || !val.trim());
    $('blacklist-match').textContent = entry ? [entry.name || entry.link, entry.project, entry.reason].filter(Boolean).join(' – ') : '';
    return !!entry;
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
const callGemini = async (promptText, opts = {}) => {
    const key = getApiKey();
    if (!key) throw new Error('NO_KEY');
    const model = safeStorage.get(STORAGE.model, DEFAULT_MODEL) || DEFAULT_MODEL;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { temperature: opts.temperature ?? 0.7 },
            ...(opts.tools ? { tools: opts.tools } : {})
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
    const customScouting = lang === 'vi' ? getAgencyConfig().templates.scouting : '';
    const { text } = await generateWithFallback(prompt, () =>
        fillTemplate(customScouting || pickRandom(lang === 'vi' ? FALLBACK_TEMPLATES.scouting : FALLBACK_TEMPLATES.scoutingEn),
            { soName: so, brand, scope, budget: bdg, focs: selectedFOCs, agency }));
    setBusy(btn, false, label);
    $('res-xingia-container').classList.remove('hidden');
    renderMarkdown($('res-xingia'), text);
};

// ================= PROCEED INTERNAL + EXTERNAL (PRE PNL template) =================
// Column letters follow the agency template: A B C D (external) · X O E F G H M (internal) · K L (result)
const fmtPct = (L) => (Number(L || 0) * 100).toFixed(2) + '%';
const fmtFollowers = (v) => { const n = parseNumber(v); return isNaN(n) ? String(v || '') : formatMoney(n); };

const getPricingSettings = () => ({
    mode: $('ext-mode').value,
    pct: num($('ext-percent').value),
    discountPct: num($('ext-discount').value),
    cbPct: num($('ext-cb').value),
    roundTo: Number($('ext-round').value) || 0,
});

const computeDeal = () => {
    const s = getPricingSettings();
    const qty = (id) => $(id).value === '' ? 1 : Math.max(0, num($(id).value));
    const base = {
        X: Math.max(0, num($('pnl-cost').value)), O: qty('pnl-qty-booking'), B: qty('ext-qty'),
        taxType: $('pnl-tax-type').value, platform: $('pnl-platform').value,
        kpiView: Math.max(0, num($('pnl-kpi').value)), kpiEng: Math.max(0, num($('pnl-kpi-eng').value)),
        discountPct: s.discountPct, cbPct: s.cbPct,
    };
    let warning = '';
    let A = 0;
    if (s.mode === 'manual') A = Math.max(0, num($('ext-price').value));
    else if (s.mode === 'margin' && s.pct + s.cbPct * 10 / 9 >= 100) warning = 'Margin mục tiêu + phí CB không thể ≥ 100%.';
    else A = KocMatcher.solvePrice({ ...base, mode: s.mode, pct: s.pct, roundTo: s.roundTo });
    const p = KocMatcher.calcPnl({ ...base, A });
    if (!warning && p.D > 0 && p.K <= 0) warning = 'Giá bán đang lỗ (lợi nhuận gộp ≤ 0).';
    if (!warning && s.mode === 'manual' && p.D > 0 && s.pct && p.L * 100 < s.pct) warning = `Margin ${fmtPct(p.L)} thấp hơn mức tối thiểu ${s.pct}%.`;
    if (!warning && base.X && !base.kpiView && !base.kpiEng) warning = 'Chưa nhập KPI commit: Cost backup (M) đang bằng 0.';
    return { ...p, ...s, taxType: base.taxType, platform: base.platform, warning };
};

// Kept for backward compatibility with old callers
const calculatePnl = () => refreshCalculations();
const calculateExt = () => refreshCalculations().D;

const BACKUP_RULE_TEXT = (plat) => {
    const r = KocMatcher.getRates().backup[plat] || {};
    const parts = [];
    if (r.view) parts.push(`KPI View × ${String(r.view).replace('.', ',')}`);
    if (r.eng) parts.push(`KPI Engagement × ${r.eng}`);
    return parts.length ? `${plat}: M = ${parts.join(' + ')} (sheet COMMIT KPI)` : '';
};

const refreshCalculations = () => {
    const d = computeDeal();
    $('pnl-total-cost').value = formatMoney(d.E);
    $('pnl-tax-calc').value = formatMoney(d.F);
    $('pnl-backup').value = formatMoney(d.M);
    $('pnl-backup-rule').textContent = BACKUP_RULE_TEXT(d.platform);
    const priceEl = $('ext-price');
    priceEl.readOnly = d.mode !== 'manual';
    if (d.mode !== 'manual' && document.activeElement !== priceEl) priceEl.value = d.A ? formatMoney(d.A) : '';
    $('ext-percent-label').textContent = d.mode === 'margin' ? 'Margin mục tiêu (%)' : d.mode === 'markup' ? 'Markup trên tổng chi phí (%)' : 'Margin tối thiểu để cảnh báo (%)';
    $('ext-c').value = formatMoney(d.C);
    $('ext-ext-cost').value = formatMoney(d.D);
    $('ext-int-cost').value = formatMoney(d.E + d.F + d.M);
    $('ext-g').value = formatMoney(d.G);
    $('ext-h').value = formatMoney(d.H);
    $('ext-margin').value = formatMoney(d.K);
    $('ext-margin-pct').value = d.D ? fmtPct(d.L) : '';
    $('ext-cpv').value = `${d.CPV ? formatMoney(d.CPV) : '—'} / ${d.CPE ? formatMoney(d.CPE) : '—'}`;
    const name = $('pnl-name').value.trim();
    $('ext-kol-summary').innerHTML = name || d.X
        ? `KOL: <b class="text-white">${escapeHtml(name || '(chưa có tên)')}</b> · Đơn giá booking ${formatMoney(d.X)} × ${d.O} · ${escapeHtml(d.taxType)} · <button class="underline" onclick="switchTab('internal')">sửa</button>`
        : 'Chưa có dữ liệu ở tab Proceed Internal.';
    $('ext-warning').textContent = d.warning;
    $('ext-warning').classList.toggle('hidden', !d.warning);
    safeStorage.set(STORAGE.pricing, JSON.stringify({ mode: d.mode, pct: $('ext-percent').value, discountPct: $('ext-discount').value, cbPct: $('ext-cb').value, roundTo: $('ext-round').value }));
    return d;
};

const loadPricingSettings = () => {
    const p = safeStorage.getJSON(STORAGE.pricing, null) || {};
    const D = typeof getAgencyConfig === 'function' ? getAgencyConfig().pricing : KocMatcher.PRICING_DEFAULTS;
    $('ext-mode').value = ['margin', 'markup', 'manual'].includes(p.mode) ? p.mode : D.mode;
    $('ext-percent').value = p.pct ?? D.pct;
    $('ext-discount').value = p.discountPct ?? D.discountPct;
    $('ext-cb').value = p.cbPct ?? D.cbPct;
    $('ext-round').value = String(p.roundTo ?? D.roundTo);
    if (!$('ext-round').value) $('ext-round').value = String(D.roundTo);
};

/** Old saved rows (before the template-accurate formulas) -> current shape. */
const upgradePnlRecord = (p) => {
    if (!p || typeof p !== 'object') return p;
    const r = { ...p };
    if (!r.id) r.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    if (r.D === undefined) {
        const ext = Number(r.extCost) || 0, cost = Number(r.intCost || r.cost) || 0;
        Object.assign(r, {
            A: ext, B: 1, C: 0, D: ext, X: cost, O: 1, E: cost, F: Number(r.tax) || 0, G: 0, H: 0, M: Number(r.backup) || 0,
            K: Number(r.grossProfit) || 0, taxType: r.taxT || 'PIT', platform: r.plat || '', scope: r.fullScope || r.scope || '',
            kpiView: Number(r.kpi) || 0, kpiEng: 0, discountPct: 0, cbPct: 0, unit: 'Video',
        });
        r.L = r.D ? r.K / r.D : 0;
        r.CPV = r.kpiView ? r.D / r.kpiView : 0;
        r.CPE = 0;
    }
    return r;
};

// Column order of each copy format comes from the agency configuration (assets/config.js)
const buildPnlCells = (p, stt, format = 'prepnl') => buildFormatRow(upgradePnlRecord(p), stt, format);

const getPnlRowData = () => {
    const d = computeDeal();
    const scopeText = $('pnl-scope').value.trim();
    const focChecks = getSelectedFocs();
    const scope = scopeText + (focChecks.length ? (scopeText ? ' + ' : '') + 'FOC: ' + focChecks.join(', ') : '');
    const keep = ['A', 'B', 'C', 'D', 'X', 'O', 'E', 'F', 'G', 'H', 'M', 'K', 'L', 'CPV', 'CPE', 'discountPct', 'cbPct', 'kpiView', 'kpiEng', 'taxType', 'platform'];
    const row = {
        name: $('pnl-name').value.trim(),
        contact: $('pnl-contact').value.trim(),
        link: $('pnl-link').value.trim(),
        followers: $('pnl-followers').value.trim(),
        scope,
        unit: $('ext-unit').value,
        paymentTerm: $('pnl-payment').value.trim(),
        note: '',
        savedAt: new Date().toISOString(),
    };
    keep.forEach(k => { row[k] = d[k]; });
    row.rawString = toTsvRow(buildPnlCells(row, 1, 'prepnl'));
    return row;
};

const exportPnl = () => {
    const data = getPnlRowData();
    if (!data.X) return showToast('Chưa nhập Đơn giá booking (X)', 'error');
    copyTextToClipboard(data.rawString);
};

const savePnlToDb = () => {
    const data = getPnlRowData();
    if (!data.name || !data.X) return showToast('Cần nhập Tên và Đơn giá booking (X)', 'error');
    if (!data.D) return showToast('Chưa có giá bán (A). Kiểm tra tab Proceed External.', 'error');
    if (findBlacklisted(data.name, data.link) && !confirm(`"${data.name}" nằm trong blacklist. Vẫn lưu?`)) return;
    const dup = savedPNL.findIndex(p => normalizeName(p.name) === normalizeName(data.name) && (p.link || '') === data.link);
    if (dup > -1) {
        if (!confirm(`"${data.name}" đã có trong kho. Ghi đè bản cũ?`)) return;
        savedPNL[dup] = { ...data, id: savedPNL[dup].id, createdAt: savedPNL[dup].createdAt, createdBy: savedPNL[dup].createdBy };
    } else {
        savedPNL.push(upgradePnlRecord(stampNew(data)));
    }
    persistPnl();
    renderDbTables();
    showToast(`Đã lưu "${data.name}" vào kho PNL (${savedPNL.length} dòng)`);
};

const exportExternal = () => {
    const data = getPnlRowData();
    if (!data.D) return showToast('Chưa có giá bán. Nhập Đơn giá booking ở Proceed Internal.', 'error');
    copyTextToClipboard(toTsvRow(buildPnlCells(data, 1, 'quotation')));
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
    const customNego = lang === 'vi' ? getAgencyConfig().templates.negotiating : '';
    const { text } = await generateWithFallback(prompt, () =>
        fillTemplate(customNego || pickRandom(lang === 'vi' ? FALLBACK_TEMPLATES.negotiating : FALLBACK_TEMPLATES.negotiatingEn), { limitCost: limit, scope, agency: getAgencyName() }));
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
    const pct = (id) => { const v = $(id).value.trim(); return v ? (isNaN(parseNumber(v)) ? v : parseNumber(v) + '%') : ''; };
    const r = {
        id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        client: cleanCell($('rep-client').value),
        camp: cleanCell($('rep-campaign').value),
        status: cleanCell($('rep-status').value),
        marginBefore: pct('rep-margin-before'),
        marginAfter: pct('rep-margin-after'),
        result: cleanCell($('rep-result').value),
        error: cleanCell($('rep-error').value),
    };
    r.rawString = reportCells(r, 1).join('\t');
    r.savedAt = new Date().toISOString();
    return r;
};
// Sheet "FORMART WEEKLY REPORT": NO | Client | Tên campaign | Status | Margin Before | Margin After | Kết quả | Lỗi sai | Note | Leader Feedback
const reportCells = (r, no) => [no, r.client, r.camp, r.status, r.marginBefore || '', r.marginAfter || '', r.result, r.error].map(cleanCell);
const exportReport = () => copyTextToClipboard(getReportData().rawString);
const saveReportToDb = () => {
    const r = getReportData();
    if (!r.client || !r.camp) return showToast('Cần nhập Client và Campaign', 'error');
    savedReports.push(stampNew(r));
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
    const rows = savedPNL.map(upgradePnlRecord);
    if (!rows.length) {
        pBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 italic py-4">Chưa có dữ liệu PNL.</td></tr>';
    } else {
        pBody.innerHTML = rows.map((p, i) => `<tr>
            <td class="text-gray-500">${i + 1}</td>
            <td>${escapeHtml(p.name)}${findBlacklisted(p.name, p.link) ? ' <i class="fas fa-exclamation-triangle text-red-500" title="Blacklist"></i>' : ''}</td>
            <td>${escapeHtml(p.platform || '-')}</td>
            <td class="text-brand-400 whitespace-nowrap">${formatMoney(p.E)}</td>
            <td class="text-green-400 whitespace-nowrap">${formatMoney(p.D)}</td>
            <td class="whitespace-nowrap">${formatMoney(p.K)} <span class="text-xs ${p.L < 0.3 ? 'text-yellow-500' : 'text-gray-500'}">${fmtPct(p.L)}</span></td>
            <td class="text-right"><button onclick="deleteRow('pnl', ${i})" class="text-gray-500 hover:text-red-500" title="Xóa dòng"><i class="fas fa-times"></i></button></td>
        </tr>`).join('');
    }
    const totalD = rows.reduce((s, p) => s + (Number(p.D) || 0), 0);
    const totalK = rows.reduce((s, p) => s + (Number(p.K) || 0), 0);
    $('stat-total-koc').textContent = rows.length;
    $('stat-total-revenue').textContent = formatMoney(totalD) + ' ₫';
    const q = getAgencyConfig().quotation;
    const fee = totalD * (q.agencyFeePct || 0) / 100;
    const vat = (totalD + fee) * (q.vatPct || 0) / 100;
    $('stat-total-vat').textContent = totalD ? `${fee ? `Agency fee ${+q.agencyFeePct}%: ${formatMoney(fee)} · ` : ''}VAT ${+q.vatPct}%: ${formatMoney(vat)} · Gồm VAT: ${formatMoney(totalD + fee + vat)}` : '';
    $('stat-total-margin').textContent = formatMoney(totalK) + ' ₫';
    $('stat-avg-margin').textContent = totalD > 0 ? `Margin: ${fmtPct(totalK / totalD)}` : '';

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
    renderTeamStats();
};

/** Per-member activity: who added KOCs, built PNL lines, revenue, margin, reports (by created date). */
const renderTeamStats = () => {
    const body = $('team-tbody');
    if (!body) return;
    const period = $('team-period').value;
    const now = new Date();
    let from = null;
    if (period === 'week') { from = new Date(now); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - ((from.getDay() + 6) % 7)); }
    if (period === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1);
    const when = (r) => r.createdAt || r.savedAt || r.updatedAt || '';
    const inPeriod = (r) => !from || (when(r) && new Date(when(r)) >= from);
    const who = (r) => (r.createdBy || r.updatedBy || '').trim() || '(chưa đặt tên)';
    const stats = new Map();
    const get = (name) => { if (!stats.has(name)) stats.set(name, { kocs: 0, pnl: 0, D: 0, K: 0, reports: 0, last: '' }); return stats.get(name); };
    const touch = (st, r) => { const t = r.updatedAt || when(r); if (t > st.last) st.last = t; };
    const kocList = typeof kocs !== 'undefined' ? kocs.filter(k => !k.demo) : [];
    kocList.filter(inPeriod).forEach(k => { const st = get(who(k)); st.kocs++; touch(st, k); });
    savedPNL.map(upgradePnlRecord).filter(inPeriod).forEach(p => { const st = get(who(p)); st.pnl++; st.D += Number(p.D) || 0; st.K += Number(p.K) || 0; touch(st, p); });
    savedReports.filter(inPeriod).forEach(r => { const st = get(who(r)); st.reports++; touch(st, r); });
    const rows = [...stats.entries()].sort((a, b) => b[1].D - a[1].D || b[1].kocs - a[1].kocs);
    body.innerHTML = rows.length ? rows.map(([name, st]) => `<tr>
        <td class="font-medium">${escapeHtml(name)}</td>
        <td>${st.kocs}</td><td>${st.pnl}</td>
        <td class="whitespace-nowrap">${formatMoney(st.D)}</td>
        <td class="whitespace-nowrap text-green-400">${formatMoney(st.K)}</td>
        <td class="${st.D && st.K / st.D < 0.3 ? 'text-yellow-500' : ''}">${st.D ? fmtPct(st.K / st.D) : '-'}</td>
        <td>${st.reports}</td>
        <td class="text-xs text-gray-400 whitespace-nowrap">${st.last ? new Date(st.last).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
    </tr>`).join('') : '<tr><td colspan="8" class="text-center text-gray-500 italic py-4">Chưa có hoạt động trong khoảng thời gian này.</td></tr>';
    $('team-note').textContent = (window.Sync && Sync.isConfigured())
        ? 'Số liệu của cả team (đồng bộ qua Google Sheet). Thành viên được ghi theo tên nhập khi tham gia team.'
        : 'Chưa kết nối Google Sheets: bảng chỉ có số liệu trên máy này. Kết nối và mời thành viên để xem hiệu quả cả team.';
};

const deleteRow = (type, index) => {
    const list = type === 'pnl' ? savedPNL : savedReports;
    const label = type === 'pnl' ? list[index]?.name : `${list[index]?.client} / ${list[index]?.camp}`;
    if (!confirm(`Xóa dòng "${label}"?`)) return;
    list.splice(index, 1);
    type === 'pnl' ? persistPnl() : persistReports();
    renderDbTables();
};

const copyBulkPnl = (format = 'prepnl') => {
    if (!savedPNL.length) return showToast('Chưa có dữ liệu để copy', 'error');
    const cfg = getAgencyConfig();
    const rows = savedPNL.map((p, i) => toTsvRow(buildPnlCells(p, i + 1, format)));
    if (cfg.copyHeader) rows.unshift(toTsvRow(formatHeaderRow(format)));
    copyTextToClipboard(rows.join('\n'));
    showToast(`Đã copy ${savedPNL.length} dòng ${cfg.formats[format].label} (${cfg.formats[format].columns.length} cột)`);
};

const copyBulkReports = () => {
    if (!savedReports.length) return showToast('Chưa có dữ liệu để copy', 'error');
    copyTextToClipboard(savedReports.map((r, i) => reportCells(r, i + 1).join('\t')).join('\n'));
    showToast(`Đã copy ${savedReports.length} dòng báo cáo`);
};

const clearDb = (type) => {
    if (!requireLead('xóa toàn bộ dữ liệu của team')) return;
    if (!confirm(`Xóa TOÀN BỘ ${type === 'pnl' ? 'PNL' : 'báo cáo tuần'} đã lưu? Không thể hoàn tác (nên Sao lưu trước).`)) return;
    if (type === 'pnl') { savedPNL = []; safeStorage.remove(STORAGE.pnl); }
    else { savedReports = []; safeStorage.remove(STORAGE.reports); }
    renderDbTables();
    showToast('Đã xóa dữ liệu');
};

const exportBackup = () => {
    const payload = { app: 'miracle-workspace', version: 3, exportedAt: new Date().toISOString(), pnl: savedPNL, reports: savedReports, blacklist: getBlacklistEntries(), kocs: typeof kocs !== 'undefined' ? kocs.filter(k => !k.demo) : [] };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `koc-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
            savedPNL = (replace ? data.pnl : savedPNL.concat(data.pnl)).map(upgradePnlRecord);
            savedReports = (replace ? data.reports : savedReports.concat(data.reports)).map(withId('r'));
            if (Array.isArray(data.blacklist)) {
                const incoming = data.blacklist.map(b => KocMatcher.normalizeBlacklistEntry(typeof b === 'string' ? { name: b } : b));
                const existing = getBlacklistEntries();
                const keys = new Set(existing.map(e => normalizeName(e.name) + '|' + e.link));
                setBlacklistEntries(existing.concat(incoming.filter(e => !keys.has(normalizeName(e.name) + '|' + e.link))));
            }
            if (Array.isArray(data.kocs) && data.kocs.length && typeof upsertKocs === 'function') upsertKocs(data.kocs.map(k => KocMatcher.normalizeKoc(k)));
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
    savedPNL = savedPNL.map(upgradePnlRecord);
    savedReports = savedReports.map(withId('r'));
    KocMatcher.configureRates((({ tax, cbTaxPct, backup }) => ({ tax, cbTaxPct, backup }))(getAgencyConfig()));
    renderFocs();
    renderSidebar();
    loadPricingSettings();
    applyAgencyConfig();

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
    if (!getApiKey()) {
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
    const syncSnap = window.Sync ? Sync.pause() : null;
    let clipboardMemory = '';
    copyTextToClipboard = async (text) => { clipboardMemory = text; };
    window.confirm = () => true;
    savedPNL = [];
    savedReports = [];
    // tests run against the default formulas/formats, whatever this agency configured
    setAgencyConfig({ ...DEFAULT_AGENCY_CONFIG(), agencyName: 'Demo Agency' }, { track: false });
    const set = (id, v) => { $(id).value = v; };

    try {
        // TEST 1: Blacklist (name or link)
        setBlacklistEntries([{ name: 'Demo Blocked', link: 'https://www.tiktok.com/@demo.blocked', reason: 'Không hợp tác' }, { name: 'Demo Second', link: '' }].map(KocMatcher.normalizeBlacklistEntry), { track: false });
        set('blacklist-input', 'Demo Blocked');
        assert(checkBlacklist() && $('blacklist-match').textContent.includes('Không hợp tác'), 'T1A Blacklist hit with reason', $('blacklist-match').textContent);
        set('blacklist-input', 'Tiến Mạnh');
        assert(!checkBlacklist(), 'T1B Blacklist miss', 'Tiến Mạnh should be safe');
        set('blacklist-input', 'a');
        assert(!checkBlacklist(), 'T1C No false positive on short input', '"a" should not match');
        set('blacklist-input', '  DEMO   BLOCKED review ');
        assert(checkBlacklist(), 'T1D Case/space insensitive', 'should match normalized name');
        assert(!!findBlacklisted('Tên khác', 'https://www.tiktok.com/@Demo.Blocked?lang=vi'), 'T1E Match by channel link even if renamed', 'link match');

        // TEST 2: Number parsing
        assert(parseNumber('10.000.000') === 10000000, 'T2A parse 10.000.000', String(parseNumber('10.000.000')));
        assert(parseNumber('120k') === 120000, 'T2B parse 120k', String(parseNumber('120k')));
        assert(parseNumber('1,2M') === 1200000, 'T2C parse 1,2M', String(parseNumber('1,2M')));
        assert(parseNumber('3tr') === 3000000, 'T2D parse 3tr', String(parseNumber('3tr')));
        assert(isNaN(parseNumber('abc')), 'T2E parse invalid', 'should be NaN');

        // TEST 3: Internal cost (E, F, M) per template
        set('pnl-platform', 'TikTok'); set('pnl-tax-type', 'HKD'); set('pnl-cost', '10000000'); set('pnl-qty-booking', '1'); set('pnl-kpi', '200000'); set('pnl-kpi-eng', '');
        let d = computeDeal();
        assert(d.M === 700000, 'T3A Backup TikTok = view × 3,5', d.M);
        assert(Math.round(d.F) === 700000, 'T3B Tax HKD = E × 7%', d.F);
        set('pnl-platform', 'FB'); set('pnl-tax-type', 'PIT'); set('pnl-cost', '9.000.000'); set('pnl-kpi', '10000'); set('pnl-kpi-eng', '2000');
        d = computeDeal();
        assert(d.M === 220000, 'T3C Backup FB = view × 15 + eng × 35', d.M);
        assert(Math.round(d.F) === 1000000, 'T3D Tax PIT = E / 9', d.F);
        set('pnl-qty-booking', '2');
        assert(computeDeal().E === 18000000, 'T3E E = X × O', computeDeal().E);
        set('pnl-qty-booking', '1');

        // TEST 4: External price (A, C, D, G, H, K, L)
        set('pnl-platform', 'TikTok'); set('pnl-tax-type', 'PIT'); set('pnl-cost', '1000000'); set('pnl-kpi', '10000'); set('pnl-kpi-eng', '');
        set('ext-mode', 'manual'); set('ext-price', '3000000'); set('ext-qty', '1'); set('ext-discount', '5'); set('ext-cb', '5'); set('ext-percent', '35');
        d = refreshCalculations();
        assert(d.C === 150000 && d.D === 2850000 && d.G === 142500 && Math.round(d.H) === 15833 && d.M === 35000, 'T4A Manual price: C, D, G, H, M per template', JSON.stringify([d.C, d.D, d.G, d.H, d.M]));
        assert(Math.round(d.K) === 1545556 && fmtPct(d.L) === '54.23%', 'T4B K and L per template', `${d.K} ${d.L}`);
        set('ext-mode', 'margin'); set('ext-round', '0');
        d = refreshCalculations();
        assert(Math.abs(d.L - 0.35) < 1e-6, 'T4C Margin mode hits 35% after discount, CB, tax, backup', d.L);
        set('ext-round', '100000');
        d = refreshCalculations();
        assert(d.A % 100000 === 0 && d.L >= 0.35, 'T4D Rounded price keeps margin ≥ target', `${d.A} ${d.L}`);
        assert($('ext-price').readOnly && $('ext-price').value === formatMoney(d.A), 'T4E Price field shows computed A', $('ext-price').value);
        set('ext-mode', 'markup'); set('ext-percent', '50'); set('ext-round', '0'); set('ext-discount', '0'); set('ext-cb', '0'); set('pnl-tax-type', 'VAT'); set('pnl-kpi', '0');
        d = refreshCalculations();
        assert(d.D === 1500000, 'T4F Markup 50% on total cost', d.D);
        set('ext-mode', 'margin'); set('ext-percent', '96'); set('ext-cb', '5');
        assert(computeDeal().warning !== '', 'T4G Impossible margin rejected', 'should warn');

        // TEST 5: Copy formats
        set('ext-mode', 'manual'); set('ext-price', '3000000'); set('ext-discount', '5'); set('ext-cb', '5'); set('pnl-tax-type', 'PIT'); set('pnl-kpi', '5000'); set('pnl-kpi-eng', '2000');
        set('pnl-name', 'KOL A'); set('pnl-contact', '0900000000'); set('pnl-link', 'https://www.tiktok.com/@kola'); set('pnl-followers', '999k'); set('pnl-scope', '1 clip\n60s\tTikTok');
        refreshCalculations();
        exportPnl();
        let cells = clipboardMemory.split('\t');
        assert(cells.length === 25 && !clipboardMemory.includes('\n'), 'T5A PRE PNL row has 25 columns, sanitized', cells.length);
        assert(cells[1] === 'KOL A' && cells[2] === '0900000000' && cells[4] === '999.000' && cells[6] === '3.000.000' && cells[9] === '150.000' && cells[10] === '2.850.000' && cells[15] === '142.500' && cells[19] === fmtPct(computeDeal().L) && cells[20] === 'PIT',
            'T5B PRE PNL column order matches template', JSON.stringify(cells));
        assert(cells[21] === '5.000' && cells[22] === '570' && cells[24] === '1.425', 'T5C KPI / CPV / CPE columns', JSON.stringify(cells.slice(21)));
        exportExternal();
        cells = clipboardMemory.split('\t');
        assert(cells.length === 14 && cells[4] === '3.000.000' && cells[8] === '2.850.000' && !clipboardMemory.includes('1.000.000'), 'T5D Quotation row: 14 columns, no internal cost', JSON.stringify(cells));

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
        assert(capturedPrompt.includes("Dạ chào anh/chị, mình là Tester - Chuyên viên Booking của Demo Agency. Hiện tại bên mình đang tìm kiếm đối tác cho dự án của nhãn hàng BrandX."), 'T6A Mandatory opening', capturedPrompt);
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

        // TEST 7: Weekly report (sheet FORMART WEEKLY REPORT)
        set('rep-client', 'Client X'); set('rep-campaign', 'Summer Sales'); set('rep-status', 'Đang đàm phán'); set('rep-margin-before', '35'); set('rep-margin-after', '32,5');
        set('rep-result', 'Line 1\nLine 2'); set('rep-error', 'No\terror');
        exportReport();
        assert(clipboardMemory.startsWith('1\tClient X\tSummer Sales\tĐang đàm phán\t35%\t32.5%'), 'T7A Report row', clipboardMemory);
        assert(!clipboardMemory.includes('\n') && clipboardMemory.split('\t').length === 8, 'T7B Report sanitized', JSON.stringify(clipboardMemory));

        // TEST 8: Local DB (isolated from real data)
        set('ext-mode', 'margin'); set('ext-percent', '35'); set('ext-round', '100000');
        set('pnl-name', 'Mock KOL 1'); set('pnl-link', 'Link 1'); set('pnl-followers', '100k'); set('pnl-platform', 'FB'); set('pnl-cost', '1000000'); set('pnl-kpi', '5000'); set('pnl-scope', 'line1\nline2');
        savePnlToDb();
        set('pnl-name', '<b onmouseover=alert(1)>Mock KOL 2</b>'); set('pnl-link', 'Link 2'); set('pnl-platform', 'TikTok'); set('pnl-cost', '5000000'); set('pnl-kpi', '15000');
        savePnlToDb();
        assert(savedPNL.length === 2 && savedPNL.every(p => p.id && p.L >= 0.35), 'T8A Saved 2 rows with ids and target margin', JSON.stringify(savedPNL.map(p => p.L)));
        set('pnl-name', 'Mock KOL 1'); set('pnl-link', 'Link 1');
        savePnlToDb();
        assert(savedPNL.length === 2, 'T8B Duplicate overwritten, not appended', savedPNL.length);
        for (const [fmt, cols] of [['prepnl', 25], ['nblist', 22], ['quotation', 14]]) {
            copyBulkPnl(fmt);
            const rows = clipboardMemory.split('\n');
            assert(rows.length === 2 && rows.every(r => r.split('\t').length === cols) && rows[0].startsWith('1\tMock KOL 1') && rows[1].startsWith('2\t'), `T8C Bulk ${fmt}: 2 rows × ${cols} cols`, JSON.stringify(rows));
        }
        assert(!$('pnl-tbody').querySelector('b'), 'T8D Names escaped in table', $('pnl-tbody').innerHTML);
        const legacy = upgradePnlRecord({ name: 'Old', extCost: 12000000, intCost: 10000000, tax: 0, backup: 0, grossProfit: 2000000, taxT: 'VAT' });
        assert(legacy.D === 12000000 && legacy.X === 10000000 && Math.abs(legacy.L - 1 / 6) < 1e-9 && legacy.id, 'T8E Legacy rows upgraded', JSON.stringify(legacy));
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
        blacklistCache = null;
        invalidateAgencyConfig();
        applyAgencyConfig();
        fieldSnap.forEach(([el, v]) => { if (el.type === 'checkbox') el.checked = v; else el.value = v; });
        focSnap.forEach(([el, v]) => { el.checked = v; });
        $('res-xingia-container').classList.add('hidden');
        $('res-dealcast-container').classList.add('hidden');
        checkBlacklist();
        refreshCalculations();
        renderDbTables();
        if (window.Sync && syncSnap) Sync.resume(syncSnap);
    }

    const passed = results.filter(r => r.pass).length;
    const failed = results.length - passed;
    console.log(`=== TESTS COMPLETE: ${passed} passed, ${failed} failed ===`);
    if (!silent) alert(`Kiểm thử hoàn tất!\n✅ Đạt: ${passed}\n❌ Lỗi: ${failed}${failed ? '\n\n' + results.filter(r => !r.pass).map(r => r.name).join('\n') : ''}\n\n(Dữ liệu của bạn không bị thay đổi.)`);
    return { passed, failed, results };
};
