'use strict';
/*
 * Agency configuration (shared by the whole team, synced through Google Sheets):
 * PNL rates, default pricing, copy formats, message templates, FOC list, agency name, license key.
 * Personal settings (API key, sync URL, user name) stay in the Settings modal.
 */

const CONFIG_KEY = 'miracle_agency_config';

// Columns available in copy formats. Keys are what agencies type in "Cấu hình agency › Format copy".
const COLUMN_DEFS = {
    stt: ['STT', (p, stt) => stt],
    name: ['Tên', p => p.name],
    contact: ['Contact', p => p.contact],
    link: ['Link kênh', p => p.link],
    followers: ['Followers', p => fmtFollowers(p.followers)],
    scope: ['Hạng mục công việc', p => p.scope],
    A: ['Chi phí (A)', p => formatMoney(p.A)],
    B: ['Số lượng (B)', p => p.B],
    unit: ['Đơn vị tính', p => p.unit || 'Video'],
    C: ['Giảm giá (C)', p => formatMoney(p.C)],
    D: ['Thành tiền (D)', p => formatMoney(p.D)],
    X: ['Đơn giá booking (X)', p => formatMoney(p.X)],
    O: ['Số lượng booking (O)', p => p.O],
    E: ['Total cost (E)', p => formatMoney(p.E)],
    F: ['Thuế booking (F)', p => formatMoney(p.F)],
    G: ['CB (G)', p => formatMoney(p.G)],
    H: ['Thuế CB (H)', p => formatMoney(p.H)],
    M: ['Cost backup (M)', p => formatMoney(p.M)],
    K: ['Lợi nhuận gộp (K)', p => formatMoney(p.K)],
    L: ['Margin (L)', p => fmtPct(p.L)],
    taxType: ['Loại thuế (Y)', p => p.taxType],
    kpiView: ['View', p => (p.kpiView ? formatMoney(p.kpiView) : '')],
    CPV: ['CPV', p => (p.CPV ? formatMoney(p.CPV) : '')],
    kpiEng: ['Engagement', p => (p.kpiEng ? formatMoney(p.kpiEng) : '')],
    CPE: ['CPE', p => (p.CPE ? formatMoney(p.CPE) : '')],
    platform: ['Nền tảng', p => p.platform],
    paymentTerm: ['Payment term', p => p.paymentTerm || ''],
    note: ['Note', p => p.note || ''],
    blank: ['(cột trống)', () => ''],
};
// Columns that reveal internal cost/margin: never in a quotation sent to the client
const INTERNAL_COLUMNS = ['X', 'O', 'E', 'F', 'G', 'H', 'M', 'K', 'L', 'taxType', 'contact', 'paymentTerm'];

const DEFAULT_FOCS = [
    'Miễn phí cung cấp mã Code Ads 7 ngày (Bắt buộc TikTok)',
    'Miễn phí SDHA 1 tháng',
    'Miễn phí ghim bài 5 ngày',
    'Miễn phí cung cấp clip gốc không chữ',
    'Miễn phí Đăng lại (Reup) qua FB Reels/Threads',
];

const DEFAULT_AGENCY_CONFIG = () => ({
    id: 'agency-config',
    agencyName: '',
    licenseKey: '',
    tax: { ...KocMatcher.DEFAULT_RATES.tax },
    cbTaxPct: KocMatcher.DEFAULT_RATES.cbTaxPct,
    backup: JSON.parse(JSON.stringify(KocMatcher.DEFAULT_RATES.backup)),
    pricing: { ...KocMatcher.PRICING_DEFAULTS },
    quotation: { vatPct: 8, agencyFeePct: 0 },
    formats: {
        prepnl: { label: 'PRE PNL', columns: ['stt', 'name', 'contact', 'link', 'followers', 'scope', 'A', 'B', 'unit', 'C', 'D', 'X', 'O', 'E', 'F', 'G', 'H', 'M', 'K', 'L', 'taxType', 'kpiView', 'CPV', 'kpiEng', 'CPE'] },
        nblist: { label: 'NB LIST', columns: ['stt', 'name', 'link', 'followers', 'contact', 'blank', 'scope', 'A', 'B', 'unit', 'D', 'X', 'O', 'E', 'F', 'G', 'H', 'K', 'L', 'taxType', 'paymentTerm', 'note'] },
        quotation: { label: 'Báo giá EXT', columns: ['stt', 'name', 'followers', 'scope', 'A', 'unit', 'B', 'C', 'D', 'kpiView', 'CPV', 'kpiEng', 'CPE', 'note'] },
    },
    copyHeader: false,
    templates: {
        scouting: '',
        negotiating: '',
        zalo: 'Dear team, mình tạo nhóm để thống nhất thông tin booking:\nCampaign: []\nKOL: []\nNền tảng: []\nHạng mục: []\nQuyền lợi kèm theo: []\nNET Cost: []\nDeadline nộp nháp: []\nNgày on-air: []',
        endCampaign: 'Dạ team ơi, dự án đã on-air. Nhờ team cung cấp danh sách KOL cần đưa vào blacklist (nếu có) để bên mình cập nhật cho các dự án sau nhé. Cảm ơn team!',
    },
    focs: DEFAULT_FOCS.slice(),
    updatedAt: '',
});

/** Fill missing keys with defaults (configs saved by older versions, or edited by hand). */
const normalizeAgencyConfig = (c) => {
    const d = DEFAULT_AGENCY_CONFIG();
    c = c && typeof c === 'object' ? c : {};
    const out = { ...d, ...c };
    out.tax = { ...d.tax, ...(c.tax || {}) };
    out.backup = { ...d.backup };
    Object.keys(d.backup).forEach(p => { out.backup[p] = { ...d.backup[p], ...((c.backup || {})[p] || {}) }; });
    out.pricing = { ...d.pricing, ...(c.pricing || {}) };
    out.quotation = { ...d.quotation, ...(c.quotation || {}) };
    out.formats = {};
    Object.keys(d.formats).forEach(f => {
        const cf = (c.formats || {})[f] || {};
        const cols = Array.isArray(cf.columns) ? cf.columns.filter(k => COLUMN_DEFS[k]) : null;
        out.formats[f] = { label: String(cf.label || d.formats[f].label), columns: cols && cols.length ? cols : d.formats[f].columns };
    });
    out.templates = { ...d.templates, ...(c.templates || {}) };
    out.focs = Array.isArray(c.focs) ? c.focs.map(String).map(x => x.trim()).filter(Boolean) : d.focs;
    out.id = 'agency-config';
    return out;
};

let agencyConfigCache = null;
const getAgencyConfig = () => {
    if (agencyConfigCache) return agencyConfigCache;
    const stored = safeStorage.getJSON(CONFIG_KEY, null);
    const cfg = normalizeAgencyConfig(stored);
    if (!stored) cfg.agencyName = (safeStorage.get(STORAGE.agency, '') || '').trim(); // older versions kept only the name
    agencyConfigCache = cfg;
    return cfg;
};
const invalidateAgencyConfig = () => { agencyConfigCache = null; };

const setAgencyConfig = (cfg, { track = true, apply = true } = {}) => {
    agencyConfigCache = normalizeAgencyConfig(cfg);
    safeStorage.set(CONFIG_KEY, JSON.stringify(agencyConfigCache));
    if (agencyConfigCache.agencyName) safeStorage.set(STORAGE.agency, agencyConfigCache.agencyName);
    if (track && window.Sync) Sync.changed('config');
    if (apply) applyAgencyConfig();
};

/** Push the configuration into the calculator and the UI. */
const applyAgencyConfig = () => {
    const cfg = getAgencyConfig();
    KocMatcher.configureRates({ tax: cfg.tax, cbTaxPct: cfg.cbTaxPct, backup: cfg.backup });
    renderFocs();
    const zalo = $('tpl-zalo'), end = $('tpl-end');
    if (zalo) zalo.value = cfg.templates.zalo;
    if (end) end.value = cfg.templates.endCampaign;
    document.querySelectorAll('[data-format-label]').forEach(el => { const f = cfg.formats[el.dataset.formatLabel]; if (f) el.textContent = f.label; });
    try { renderSidebar(); switchTab(currentTabId); } catch (e) { }
    try { refreshCalculations(); renderDbTables(); } catch (e) { }
    if (window.License) License.refresh();
};

const renderFocs = () => {
    const box = $('foc-container');
    if (!box) return;
    const checked = new Set(getSelectedFocs());
    box.innerHTML = getAgencyConfig().focs.map(f => `
        <label class="flex items-center space-x-3 cursor-pointer group">
            <input type="checkbox" value="${escapeHtml(f)}" ${checked.has(f) ? 'checked' : ''}
                class="w-5 h-5 rounded border-gray-600 text-brand-500 focus:ring-brand-500 bg-dark-900">
            <span class="text-gray-300 group-hover:text-white transition-colors">${escapeHtml(f)}</span>
        </label>`).join('') || '<p class="text-sm text-gray-500">Chưa có quyền lợi nào. Thêm trong Cấu hình agency.</p>';
};

/** Build one copy row for a PNL record using the agency's column list. */
const buildFormatRow = (p, stt, format) => {
    const cols = getAgencyConfig().formats[format].columns;
    return cols.map(k => COLUMN_DEFS[k][1](p, stt));
};
const formatHeaderRow = (format) => getAgencyConfig().formats[format].columns.map(k => COLUMN_DEFS[k][0]);

// ================= CONFIG TAB UI =================
const pctInput = (id, value, extra = '') => `<input type="text" inputmode="decimal" id="${id}" value="${escapeHtml(String(+Number(value).toFixed(4)).replace('.', ','))}" class="input-dark" ${extra}>`;
const readPct = (id, fallback) => {
    const n = parseNumber($(id).value);
    if (isNaN(n) || n < 0) return fallback;
    return Math.abs(n - 100 / 9) < 5e-4 ? 100 / 9 : n; // keep "÷ 9" exact
};

const renderConfigTab = () => {
    const cfg = getAgencyConfig();
    const lic = window.License ? License.status() : { enabled: false };
    const platforms = Object.keys(cfg.backup);
    const fmtKeys = Object.keys(cfg.formats);
    $('tab-config').innerHTML = `
        <div class="mb-6 flex flex-wrap justify-between items-end gap-3">
            <div>
                <h2 class="text-3xl font-bold text-white mb-2">Cấu hình agency</h2>
                <p class="text-gray-400">Áp dụng cho cả team (đồng bộ qua Google Sheets nếu đã kết nối). Cài đặt cá nhân như API key nằm ở nút Cài đặt.</p>
            </div>
            <button onclick="saveConfigFromForm()" class="btn-success"><i class="fas fa-save"></i> Lưu cấu hình</button>
        </div>

        <div class="card space-y-4">
            <h3 class="text-lg font-semibold text-white"><i class="fas fa-building text-blue-400 mr-2"></i>Agency & bản quyền</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label class="label-dark" for="cfg-agency">Tên agency (dùng trong tin nhắn gửi KOC)</label>
                    <input type="text" id="cfg-agency" class="input-dark" value="${escapeHtml(cfg.agencyName)}" ${lic.valid ? 'readonly title="Theo bản quyền"' : ''} placeholder="VD: ABC Media"></div>
                <div id="cfg-license-status" class="text-sm self-end">${window.License ? License.describe() : ''}</div>
            </div>
            ${lic.enabled ? `<div><label class="label-dark" for="cfg-license">Mã bản quyền</label>
                <textarea id="cfg-license" class="input-dark h-20 font-mono text-xs" placeholder="Dán mã bản quyền nhà cung cấp gửi">${escapeHtml(cfg.licenseKey)}</textarea>
                <button onclick="License.activate(document.getElementById('cfg-license').value)" class="btn-primary text-sm mt-2"><i class="fas fa-unlock"></i> Kích hoạt</button></div>` : ''}
        </div>

        <div class="card space-y-4">
            <h3 class="text-lg font-semibold text-white"><i class="fas fa-calculator text-green-400 mr-2"></i>Công thức PNL</h3>
            <p class="text-xs text-gray-500">Mặc định theo template PRE PNL: F = E × thuế, H = G × thuế CB, M = KPI × hệ số. "11,1111%" tương đương chia 9.</p>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div><label class="label-dark" for="cfg-tax-PIT">Thuế PIT (% của E)</label>${pctInput('cfg-tax-PIT', cfg.tax.PIT)}</div>
                <div><label class="label-dark" for="cfg-tax-HKD">Thuế HKD (% của E)</label>${pctInput('cfg-tax-HKD', cfg.tax.HKD)}</div>
                <div><label class="label-dark" for="cfg-tax-VAT">Thuế VAT (% của E)</label>${pctInput('cfg-tax-VAT', cfg.tax.VAT)}</div>
                <div><label class="label-dark" for="cfg-cbtax">Thuế CB (% của G)</label>${pctInput('cfg-cbtax', cfg.cbTaxPct)}</div>
            </div>
            <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Cost backup</th><th>× KPI View</th><th>× KPI Engagement</th></tr></thead><tbody>
                ${platforms.map(p => `<tr><td>${escapeHtml(p)}</td><td>${pctInput(`cfg-bk-${p}-view`, cfg.backup[p].view)}</td><td>${pctInput(`cfg-bk-${p}-eng`, cfg.backup[p].eng)}</td></tr>`).join('')}
            </tbody></table></div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div><label class="label-dark" for="cfg-margin">Margin mục tiêu mặc định (%)</label>${pctInput('cfg-margin', cfg.pricing.pct)}</div>
                <div><label class="label-dark" for="cfg-discount">Giảm giá mặc định (%)</label>${pctInput('cfg-discount', cfg.pricing.discountPct)}</div>
                <div><label class="label-dark" for="cfg-cb">Phí CB mặc định (%)</label>${pctInput('cfg-cb', cfg.pricing.cbPct)}</div>
                <div><label class="label-dark" for="cfg-round">Làm tròn giá bán</label>
                    <select id="cfg-round" class="input-dark">${[0, 10000, 100000, 500000].map(v => `<option value="${v}" ${+cfg.pricing.roundTo === v ? 'selected' : ''}>${v ? formatMoney(v) : 'Không'}</option>`).join('')}</select></div>
                <div><label class="label-dark" for="cfg-vat">VAT trên báo giá (%)</label>${pctInput('cfg-vat', cfg.quotation.vatPct)}</div>
                <div><label class="label-dark" for="cfg-fee">Agency fee (% Σ thành tiền)</label>${pctInput('cfg-fee', cfg.quotation.agencyFeePct)}</div>
            </div>
        </div>

        <div class="card space-y-4">
            <h3 class="text-lg font-semibold text-white"><i class="fas fa-table-columns text-brand-500 mr-2"></i>Format copy sang Excel</h3>
            <p class="text-xs text-gray-500">Mỗi format là danh sách mã cột, cách nhau bằng dấu phẩy, theo đúng thứ tự cột trong file Excel của agency. Mã cột:
                ${Object.entries(COLUMN_DEFS).map(([k, [label]]) => `<code class="text-gray-300">${k}</code>=${escapeHtml(label)}`).join(' · ')}</p>
            ${fmtKeys.map(f => `<div class="grid grid-cols-1 sm:grid-cols-4 gap-3 items-start">
                <div><label class="label-dark" for="cfg-fmt-label-${f}">Tên nút</label><input type="text" id="cfg-fmt-label-${f}" class="input-dark" value="${escapeHtml(cfg.formats[f].label)}"></div>
                <div class="sm:col-span-3"><label class="label-dark" for="cfg-fmt-${f}">Các cột (${cfg.formats[f].columns.length})</label>
                    <input type="text" id="cfg-fmt-${f}" class="input-dark font-mono text-xs" value="${escapeHtml(cfg.formats[f].columns.join(', '))}">
                    ${f === 'quotation' ? '<p class="text-xs text-gray-500 mt-1">Đây là bản gửi khách: tool sẽ không cho lưu nếu có cột nội bộ (X, E, F, G, H, M, K, L, thuế, contact, payment term).</p>' : ''}</div>
            </div>`).join('')}
            <label class="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" id="cfg-copy-header" ${cfg.copyHeader ? 'checked' : ''}> Copy hàng loạt kèm dòng tiêu đề</label>
        </div>

        <div class="card space-y-4">
            <h3 class="text-lg font-semibold text-white"><i class="fas fa-comment-dots text-yellow-400 mr-2"></i>Mẫu tin nhắn & quyền lợi</h3>
            <p class="text-xs text-gray-500">Dùng khi chưa có AI hoặc AI lỗi. Biến: <code>{agency}</code> <code>{soName}</code> <code>{brand}</code> <code>{scope}</code> <code>{budget}</code> <code>{focs}</code> <code>{limitCost}</code>. Để trống để dùng mẫu có sẵn.</p>
            <div><label class="label-dark" for="cfg-tpl-scouting">Tin nhắn xin giá (tiếng Việt)</label><textarea id="cfg-tpl-scouting" class="input-dark h-24 text-sm">${escapeHtml(cfg.templates.scouting)}</textarea></div>
            <div><label class="label-dark" for="cfg-tpl-negotiating">Tin nhắn ép giá (tiếng Việt)</label><textarea id="cfg-tpl-negotiating" class="input-dark h-24 text-sm">${escapeHtml(cfg.templates.negotiating)}</textarea></div>
            <div><label class="label-dark" for="cfg-tpl-zalo">Mẫu tạo nhóm Zalo confirm</label><textarea id="cfg-tpl-zalo" class="input-dark h-32 text-sm font-mono">${escapeHtml(cfg.templates.zalo)}</textarea></div>
            <div><label class="label-dark" for="cfg-tpl-end">Mẫu kết thúc campaign</label><textarea id="cfg-tpl-end" class="input-dark h-20 text-sm">${escapeHtml(cfg.templates.endCampaign)}</textarea></div>
            <div><label class="label-dark" for="cfg-focs">Quyền lợi miễn phí (FOC), mỗi dòng 1 mục</label><textarea id="cfg-focs" class="input-dark h-32 text-sm">${escapeHtml(cfg.focs.join('\n'))}</textarea></div>
        </div>

        <div class="card flex flex-wrap gap-2 items-center">
            <button onclick="exportAgencyConfig()" class="btn-secondary text-sm"><i class="fas fa-download"></i> Xuất cấu hình (JSON)</button>
            <button onclick="document.getElementById('cfg-import').click()" class="btn-secondary text-sm"><i class="fas fa-upload"></i> Nhập cấu hình</button>
            <input type="file" id="cfg-import" accept=".json,application/json" class="hidden" onchange="importAgencyConfig(event)">
            <button onclick="resetAgencyConfig()" class="btn-secondary text-sm"><i class="fas fa-rotate-left"></i> Khôi phục mặc định</button>
            <div class="flex-1"></div>
            <button onclick="saveConfigFromForm()" class="btn-success"><i class="fas fa-save"></i> Lưu cấu hình</button>
        </div>`;
};

/** Read the config form. Returns { cfg } or { error }. */
const readConfigForm = () => {
    const cur = getAgencyConfig();
    const cfg = JSON.parse(JSON.stringify(cur));
    cfg.agencyName = $('cfg-agency').value.trim();
    if ($('cfg-license')) cfg.licenseKey = $('cfg-license').value.trim();
    ['PIT', 'HKD', 'VAT'].forEach(t => { cfg.tax[t] = readPct(`cfg-tax-${t}`, cur.tax[t]); });
    cfg.cbTaxPct = readPct('cfg-cbtax', cur.cbTaxPct);
    Object.keys(cfg.backup).forEach(p => {
        cfg.backup[p] = { view: readPct(`cfg-bk-${p}-view`, cur.backup[p].view), eng: readPct(`cfg-bk-${p}-eng`, cur.backup[p].eng) };
    });
    cfg.pricing = { ...cfg.pricing, pct: readPct('cfg-margin', cur.pricing.pct), discountPct: readPct('cfg-discount', cur.pricing.discountPct), cbPct: readPct('cfg-cb', cur.pricing.cbPct), roundTo: Number($('cfg-round').value) || 0 };
    cfg.quotation = { vatPct: readPct('cfg-vat', cur.quotation.vatPct), agencyFeePct: readPct('cfg-fee', cur.quotation.agencyFeePct) };
    for (const f of Object.keys(cfg.formats)) {
        const keys = $(`cfg-fmt-${f}`).value.split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
        const bad = keys.filter(k => !COLUMN_DEFS[k]);
        if (bad.length) return { error: `Format "${cfg.formats[f].label}": mã cột không hợp lệ ${bad.join(', ')}` };
        if (!keys.length) return { error: `Format "${cfg.formats[f].label}" chưa có cột nào` };
        if (f === 'quotation') {
            const leak = keys.filter(k => INTERNAL_COLUMNS.includes(k));
            if (leak.length) return { error: `Báo giá gửi khách không được có cột nội bộ: ${leak.join(', ')}` };
        }
        cfg.formats[f] = { label: $(`cfg-fmt-label-${f}`).value.trim() || cfg.formats[f].label, columns: keys };
    }
    cfg.copyHeader = $('cfg-copy-header').checked;
    cfg.templates = {
        scouting: $('cfg-tpl-scouting').value.trim(), negotiating: $('cfg-tpl-negotiating').value.trim(),
        zalo: $('cfg-tpl-zalo').value, endCampaign: $('cfg-tpl-end').value,
    };
    cfg.focs = $('cfg-focs').value.split('\n').map(x => x.trim()).filter(Boolean);
    if (cfg.pricing.pct + cfg.pricing.cbPct * (1 + cfg.cbTaxPct / 100) >= 100) return { error: 'Margin mục tiêu + phí CB phải nhỏ hơn 100%' };
    return { cfg };
};

const saveConfigFromForm = () => {
    const { cfg, error } = readConfigForm();
    if (error) return showToast(error, 'error');
    const pricingChanged = JSON.stringify(cfg.pricing) !== JSON.stringify(getAgencyConfig().pricing);
    setAgencyConfig(cfg);
    if (pricingChanged) { safeStorage.remove(STORAGE.pricing); loadPricingSettings(); refreshCalculations(); }
    renderConfigTab();
    showToast('Đã lưu cấu hình agency');
};

const exportAgencyConfig = () => {
    const { licenseKey, ...rest } = getAgencyConfig();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'koc-booking-workspace', kind: 'agency-config', config: rest }, null, 2)], { type: 'application/json' }));
    a.download = 'cau-hinh-agency.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
};

const importAgencyConfig = (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    file.text().then(text => {
        const data = JSON.parse(text);
        const incoming = data.config || data;
        if (!incoming || typeof incoming !== 'object' || !incoming.formats) throw new Error('File không phải cấu hình agency');
        if (!confirm('Thay cấu hình hiện tại bằng cấu hình trong file? (Mã bản quyền giữ nguyên)')) return;
        setAgencyConfig({ ...incoming, licenseKey: getAgencyConfig().licenseKey });
        renderConfigTab();
        showToast('Đã nhập cấu hình');
    }).catch(err => showToast('Không đọc được file: ' + err.message, 'error'));
};

const resetAgencyConfig = () => {
    if (!confirm('Khôi phục công thức, format, mẫu tin nhắn về mặc định? (Tên agency và bản quyền giữ nguyên)')) return;
    const cur = getAgencyConfig();
    setAgencyConfig({ ...DEFAULT_AGENCY_CONFIG(), agencyName: cur.agencyName, licenseKey: cur.licenseKey });
    safeStorage.remove(STORAGE.pricing);
    loadPricingSettings();
    refreshCalculations();
    renderConfigTab();
    showToast('Đã khôi phục mặc định');
};

// ================= ONBOARDING CHECKLIST (Brief tab) =================
const ONBOARDING_HIDDEN = 'miracle_onboarding_hidden';
const BOOKMARKLET_SEEN = 'miracle_bookmarklet_seen';
const renderOnboarding = () => {
    const box = $('onboarding');
    if (!box) return;
    const steps = [
        ['Đặt tên agency và kiểm tra công thức PNL, format copy', !!getAgencyConfig().agencyName, "switchTab('config')", 'Mở cấu hình'],
        ['Nạp Kho KOC từ file NB LIST / PRE PNL / Excel', typeof kocs !== 'undefined' && kocs.some(k => !k.demo), "openImportModal('koc')", 'Nhập file'],
        ['Nhập Blacklist của agency', getBlacklistEntries().length > 0, "openImportModal('blacklist')", 'Nhập blacklist'],
        ['Kết nối Google Sheets để cả team dùng chung (khuyên dùng)', !!(window.Sync && Sync.isConfigured()), "openModal('settings')", 'Kết nối'],
        ['Thêm Gemini API key để dùng AI (không bắt buộc)', !!safeStorage.get(STORAGE.apiKey, ''), "openModal('settings')", 'Thêm key'],
        ['Cài bookmark "Phân tích KOC" để soi kênh TikTok', !!safeStorage.get(BOOKMARKLET_SEEN, ''), "safeStorage.set('" + BOOKMARKLET_SEEN + "','1');openModal('bookmarklet');renderOnboarding()", 'Cài đặt'],
    ];
    const done = steps.filter(s => s[1]).length;
    if (safeStorage.get(ONBOARDING_HIDDEN, '') || done === steps.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="card border border-brand-600/40">
        <div class="flex justify-between items-center mb-3">
            <h3 class="text-lg font-semibold text-white"><i class="fas fa-flag-checkered text-brand-500 mr-2"></i>Bắt đầu sử dụng (${done}/${steps.length})</h3>
            <button onclick="safeStorage.set('${ONBOARDING_HIDDEN}','1');renderOnboarding()" class="text-xs text-gray-500 hover:text-gray-300">Ẩn</button>
        </div>
        <div class="h-1.5 rounded bg-dark-700 mb-3 overflow-hidden"><div class="h-full bg-brand-500" style="width:${Math.round(done / steps.length * 100)}%"></div></div>
        <ol class="space-y-2 text-sm">${steps.map(([text, ok, action, label]) => `
            <li class="flex items-center gap-3 ${ok ? 'text-gray-500 line-through' : 'text-gray-200'}">
                <i class="fas ${ok ? 'fa-circle-check text-green-500' : 'fa-circle text-gray-600'}"></i>
                <span class="flex-1">${escapeHtml(text)}</span>
                ${ok ? '' : `<button onclick="${action}" class="px-2 py-1 rounded text-xs bg-dark-700 hover:bg-dark-600 text-gray-200 no-underline">${label}</button>`}
            </li>`).join('')}</ol>
    </div>`;
};
document.addEventListener('DOMContentLoaded', () => setTimeout(renderOnboarding, 0));
