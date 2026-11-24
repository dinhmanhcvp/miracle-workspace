'use strict';
/*
 * KOC database (Kho KOC) + Brief matching UI.
 * Depends on: assets/matcher.js (KocMatcher) and assets/app.js (helpers, tabs, storage).
 */

const KM = KocMatcher;
const labelOf = (list, id) => (list.find(x => x.id === id) || {}).label || id;

// ================= STATE =================
let kocs = safeStorage.getJSON(STORAGE.kocs, []);
if (!Array.isArray(kocs)) kocs = [];
let shortlistIds = safeStorage.getJSON(STORAGE.shortlist, []);
if (!Array.isArray(shortlistIds)) shortlistIds = [];
let lastRanking = null; // { matches, excluded }

const persistKocs = ({ track = true } = {}) => { safeStorage.set(STORAGE.kocs, JSON.stringify(kocs)); updateKocBadge(); if (track && window.Sync) Sync.changed('kocs'); };
const persistShortlist = () => safeStorage.set(STORAGE.shortlist, JSON.stringify(shortlistIds));
const updateKocBadge = () => { const b = $('koc-count'); if (b) b.textContent = kocs.length; };

// ================= CHIPS =================
const CHIP_ON = ['bg-brand-600', 'border-brand-500', 'text-white'];
const CHIP_OFF = ['bg-dark-900', 'border-gray-700', 'text-gray-400'];
const renderChips = (containerId, options, selected = [], onChange) => {
    const el = $(containerId);
    el.innerHTML = options.map(o => `<button type="button" data-id="${escapeHtml(o.id)}" class="chip px-3 py-1.5 rounded-full border text-xs transition-colors">${escapeHtml(o.label)}</button>`).join('');
    el.querySelectorAll('.chip').forEach(btn => {
        setChip(btn, selected.includes(btn.dataset.id));
        btn.addEventListener('click', () => { setChip(btn, btn.dataset.on !== '1'); if (onChange) onChange(); });
    });
};
const setChip = (btn, on) => {
    btn.dataset.on = on ? '1' : '0';
    btn.classList.remove(...(on ? CHIP_OFF : CHIP_ON));
    btn.classList.add(...(on ? CHIP_ON : CHIP_OFF));
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
};
const getChips = (containerId) => Array.from($(containerId).querySelectorAll('.chip')).filter(b => b.dataset.on === '1').map(b => b.dataset.id);
const setChips = (containerId, ids = []) => $(containerId).querySelectorAll('.chip').forEach(b => setChip(b, ids.includes(b.dataset.id)));

const CATEGORY_OPTS = KM.CATEGORIES.map(c => ({ id: c.id, label: c.label }));
const PLATFORM_OPTS = KM.PLATFORMS.map(p => ({ id: p.id, label: p.label }));
const AGE_OPTS = KM.AGES.map(a => ({ id: a, label: a }));
const LOCATION_OPTS = KM.LOCATIONS.map(l => ({ id: l.id, label: l.id }));
const TIER_OPTS = KM.TIERS.map(t => ({ id: t.id, label: t.label }));

// ================= KOC DATABASE =================
const kocKey = (k) => (k.link ? 'l:' + KM.norm(k.link).replace(/[?#].*$/, '').replace(/\/+$/, '') : 'n:' + KM.norm(k.name) + '|' + k.platform);

/** Insert or update KOCs (matched by link, or name + platform). Returns { added, updated }. */
const upsertKocs = (list) => {
    let added = 0, updated = 0;
    const index = new Map(kocs.map((k, i) => [kocKey(k), i]));
    list.forEach(k => {
        const i = index.get(kocKey(k));
        if (i !== undefined) {
            const old = kocs[i];
            // keep existing values when the import leaves a field empty
            const merged = { ...old };
            Object.entries(k).forEach(([f, v]) => {
                const empty = v === '' || v === 0 || (Array.isArray(v) && !v.length);
                if (!empty || f === 'demo') merged[f] = v;
            });
            merged.id = old.id;
            merged.demo = old.demo && k.demo;
            kocs[i] = merged;
            updated++;
        } else {
            kocs.push(stampNew(k));
            index.set(kocKey(k), kocs.length - 1);
            added++;
        }
    });
    persistKocs();
    return { added, updated };
};

const renderKocFilters = () => {
    const p = $('koc-filter-platform'), c = $('koc-filter-cat');
    const pv = p.value, cv = c.value;
    p.innerHTML = '<option value="">Tất cả nền tảng</option>' + PLATFORM_OPTS.map(o => `<option value="${o.id}">${o.label}</option>`).join('');
    c.innerHTML = '<option value="">Tất cả ngành</option>' + CATEGORY_OPTS.map(o => `<option value="${o.id}">${o.label}</option>`).join('');
    p.value = pv; c.value = cv;
};

const kocAudienceText = (k) => [k.gender ? labelOf(KM.GENDERS, k.gender).replace('Chủ yếu ', '') : '', (k.ages || []).join(', '), k.location].filter(Boolean).join(' · ');

const renderKocTable = () => {
    const q = KM.norm($('koc-search').value);
    const fp = $('koc-filter-platform').value;
    const fc = $('koc-filter-cat').value;
    const list = kocs.filter(k => (!fp || k.platform === fp) && (!fc || (k.categories || []).includes(fc)) &&
        (!q || KM.norm(`${k.name} ${k.notes} ${k.location} ${k.contact}`).includes(q)));
    const tb = $('koc-tbody');
    if (!kocs.length) {
        tb.innerHTML = `<tr><td colspan="9" class="text-center text-gray-500 italic py-8">Kho KOC trống. Bấm <b>Dán từ Excel/Sheets</b> để nhập danh sách, hoặc <b>Dữ liệu mẫu</b> để dùng thử.</td></tr>`;
    } else if (!list.length) {
        tb.innerHTML = '<tr><td colspan="9" class="text-center text-gray-500 italic py-6">Không có KOC nào khớp bộ lọc.</td></tr>';
    } else {
        tb.innerHTML = list.map(k => `<tr class="${k.status === 'inactive' ? 'opacity-50' : ''}">
            <td><div class="font-medium">${k.link ? `<a href="${escapeHtml(k.link)}" target="_blank" rel="noopener noreferrer" class="hover:text-brand-400">${escapeHtml(k.name)}</a>` : escapeHtml(k.name)}${findBlacklisted(k.name, k.link) ? ' <i class="fas fa-ban text-red-500" title="Blacklist"></i>' : ''}${k.demo ? ' <span class="text-[10px] px-1.5 rounded bg-dark-700 text-gray-400">mẫu</span>' : ''}</div>
                ${k.rating ? `<div class="text-xs text-yellow-500">${'★'.repeat(Math.round(k.rating))}</div>` : ''}</td>
            <td>${escapeHtml(labelOf(KM.PLATFORMS, k.platform) || '-')}</td>
            <td class="whitespace-nowrap">${k.followers ? KM.formatFollowers(k.followers) : '-'}</td>
            <td class="whitespace-nowrap">${k.avgViews ? KM.formatFollowers(k.avgViews) : '-'}</td>
            <td class="whitespace-nowrap">${k.er ? k.er + '%' : '-'}</td>
            <td class="text-xs">${(k.categories || []).map(c => escapeHtml(labelOf(KM.CATEGORIES, c))).join(', ') || '-'}</td>
            <td class="text-xs text-gray-400">${escapeHtml(kocAudienceText(k)) || '-'}</td>
            <td class="whitespace-nowrap text-brand-400" title="${k.lastQuote ? 'Giá bán gần nhất: ' + formatMoney(k.lastQuote) : ''}">${k.rate ? formatMoney(k.rate) : '-'}${k.lastQuote ? `<div class="text-[10px] text-gray-500">bán ${formatMoney(k.lastQuote)}</div>` : ''}</td>
            <td class="whitespace-nowrap text-right">
                <button onclick="openKocModal('${k.id}')" class="text-gray-400 hover:text-white px-1" title="Sửa"><i class="fas fa-pen"></i></button>
                <button onclick="deleteKoc('${k.id}')" class="text-gray-500 hover:text-red-500 px-1" title="Xóa"><i class="fas fa-times"></i></button>
            </td></tr>`).join('');
    }
    const demoCount = kocs.filter(k => k.demo).length;
    $('koc-table-footer').textContent = kocs.length ? `Hiển thị ${list.length}/${kocs.length} KOC${demoCount ? ` (gồm ${demoCount} KOC mẫu)` : ''}.` : '';
    updateKocBadge();
};

const openKocModal = (id) => {
    const k = kocs.find(x => x.id === id) || KM.normalizeKoc({ id: '' });
    $('koc-modal-title').textContent = id ? 'Sửa KOC' : 'Thêm KOC';
    $('koc-id').value = id || '';
    $('koc-name').value = k.name;
    $('koc-platform').value = k.platform || 'TikTok';
    $('koc-link').value = k.link;
    $('koc-contact').value = k.contact;
    $('koc-followers').value = k.followers || '';
    $('koc-views').value = k.avgViews || '';
    $('koc-er').value = k.er || '';
    $('koc-rate').value = k.rate ? formatMoney(k.rate) : '';
    $('koc-tax').value = k.taxType || 'PIT';
    $('koc-gender').value = k.gender || '';
    $('koc-location').value = k.location || '';
    $('koc-rating').value = String(Math.round(k.rating || 0));
    $('koc-notes').value = k.notes || '';
    $('koc-status').value = k.status || 'active';
    setChips('koc-categories', k.categories || []);
    setChips('koc-ages', k.ages || []);
    openModal('koc');
    setTimeout(() => $('koc-name').focus(), 50);
};

const saveKocFromModal = () => {
    const id = $('koc-id').value;
    const data = KM.normalizeKoc({
        id: id || undefined,
        name: $('koc-name').value, platform: $('koc-platform').value, link: $('koc-link').value, contact: $('koc-contact').value,
        followers: $('koc-followers').value, avgViews: $('koc-views').value, er: $('koc-er').value, rate: $('koc-rate').value,
        taxType: $('koc-tax').value, gender: $('koc-gender').value, location: $('koc-location').value, rating: $('koc-rating').value,
        notes: $('koc-notes').value, status: $('koc-status').value,
        categories: getChips('koc-categories'), ages: getChips('koc-ages'),
    });
    if (!data.name) return showToast('Cần nhập tên KOC', 'error');
    if (id) {
        const i = kocs.findIndex(k => k.id === id);
        if (i > -1) kocs[i] = { ...data, demo: false };
        persistKocs();
    } else {
        const { updated } = upsertKocs([data]);
        if (updated) showToast('KOC đã có trong kho, đã cập nhật thông tin', 'info');
    }
    closeModal('koc');
    renderKocTable();
    showToast(`Đã lưu "${data.name}"`);
};

const deleteKoc = (id) => {
    const k = kocs.find(x => x.id === id);
    if (!k || !confirm(`Xóa "${k.name}" khỏi Kho KOC?`)) return;
    kocs = kocs.filter(x => x.id !== id);
    shortlistIds = shortlistIds.filter(x => x !== id);
    persistKocs();
    persistShortlist();
    renderKocTable();
};

const clearKocs = () => {
    if (kocs.some(k => !k.demo) && !requireLead('xóa Kho KOC của team')) return;
    const demo = kocs.filter(k => k.demo).length;
    if (!kocs.length) return showToast('Kho KOC đang trống', 'info');
    if (demo && demo < kocs.length && confirm(`Chỉ xóa ${demo} KOC mẫu?\n(OK = chỉ xóa dữ liệu mẫu, Cancel = chọn xóa tất cả)`)) {
        kocs = kocs.filter(k => !k.demo);
    } else {
        if (!confirm(`Xóa TOÀN BỘ ${kocs.length} KOC trong kho? Nên Export CSV trước. Không thể hoàn tác.`)) return;
        kocs = [];
    }
    shortlistIds = shortlistIds.filter(id => kocs.some(k => k.id === id));
    persistKocs();
    persistShortlist();
    renderKocTable();
    showToast('Đã xóa');
};

// ================= IMPORT (paste / CSV / .xlsx, with column mapping) =================
const XLSX_SRC = 'assets/vendor/xlsx.full.min.js'; // loaded only when a workbook is imported
let importState = { rows: null, sheets: null, workbook: null, fields: null, table: null };

const loadScriptOnce = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`) && window.XLSX) return resolve();
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = () => reject(new Error('Không tải được thư viện đọc Excel (kiểm tra mạng)'));
    document.head.appendChild(el);
});

const openImportModal = (target = 'koc') => {
    importState = { rows: null, sheets: null, workbook: null, fields: null, table: null };
    $('import-target').value = target;
    $('paste-text').value = '';
    $('import-file-xlsx').value = '';
    $('import-sheet-wrap').classList.add('hidden');
    $('import-mapping').innerHTML = '';
    $('paste-preview').textContent = '';
    openModal('paste');
};

const sheetRows = (wb, name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });

const loadImportFile = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
        if (/\.(csv|tsv|txt)$/i.test(file.name)) {
            const text = await file.text();
            $('paste-text').value = '';
            importState = { rows: KM.parseDelimited(text), sheets: null };
            $('import-sheet-wrap').classList.add('hidden');
            return analyzeImport();
        }
        $('paste-preview').textContent = 'Đang đọc file...';
        await loadScriptOnce(XLSX_SRC);
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const target = $('import-target').value;
        const hidden = new Set(((wb.Workbook && wb.Workbook.Sheets) || []).filter(x => x.Hidden).map(x => x.name));
        const ranked = wb.SheetNames.map(name => {
            const t = KM.detectTable(sheetRows(wb, name), target);
            return { name, score: t ? t.score : 0, hidden: hidden.has(name) };
        });
        const best = ranked.filter(x => !x.hidden).sort((a, b) => b.score - a.score)[0] || ranked[0];
        $('import-sheet').innerHTML = ranked.map(x => `<option value="${escapeHtml(x.name)}">${escapeHtml(x.name)}${x.hidden ? ' (ẩn)' : ''}${x.score ? ` – nhận ${x.score} cột` : ''}</option>`).join('');
        $('import-sheet').value = best.name;
        $('import-sheet-wrap').classList.remove('hidden');
        $('paste-text').value = '';
        importState = { workbook: wb, rows: null };
        selectImportSheet();
    } catch (err) {
        $('paste-preview').textContent = '⚠️ ' + err.message;
    }
};

const selectImportSheet = () => {
    if (!importState.workbook) return;
    importState.rows = sheetRows(importState.workbook, $('import-sheet').value);
    importState.fields = null;
    analyzeImport();
};

const analyzeImport = ({ keepFields = false } = {}) => {
    const text = $('paste-text').value;
    if (text.trim()) { importState.rows = KM.parseDelimited(text); if (!keepFields) importState.fields = null; }
    const rows = importState.rows;
    if (!rows || !rows.length) { $('import-mapping').innerHTML = ''; $('paste-preview').textContent = ''; return null; }
    const target = $('import-target').value;
    const r = KM.importTable(rows, { target, fields: keepFields ? importState.fields : undefined });
    if (!keepFields) { importState.fields = r.table ? r.table.fields.slice() : null; importState.table = r.table; }
    renderImportMapping(target);
    const key = target === 'blacklist' ? 'mục blacklist' : 'KOC';
    $('paste-preview').innerHTML = r.error ? '⚠️ ' + escapeHtml(r.error)
        : `Đọc được <b class="text-white">${r.records.length}</b> ${key}${r.skipped ? `, bỏ qua ${r.skipped} dòng` : ''}. Ví dụ: ${r.records.slice(0, 5).map(x => escapeHtml(x.name || x.link)).join(', ')}${r.records.length > 5 ? '…' : ''}`;
    importState.result = r;
    return r;
};

const renderImportMapping = (target) => {
    const t = importState.table;
    if (!t) { $('import-mapping').innerHTML = ''; return; }
    const options = (KM.FIELD_RULES[target] || KM.FIELD_RULES.koc).map(([f]) => f);
    $('import-mapping').innerHTML = `<div class="text-xs text-gray-400 mb-2">Cột nhận diện được (dòng tiêu đề số ${t.headerRow + 1}). Sửa nếu tool nhận sai:</div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">${t.labels.map((label, i) => label ? `
            <label class="block text-xs"><span class="text-gray-400 truncate block" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
            <select data-col="${i}" class="input-dark !py-1 text-xs import-field">
                <option value="">— bỏ qua —</option>
                ${options.map(f => `<option value="${f}" ${importState.fields[i] === f ? 'selected' : ''}>${escapeHtml(KM.FIELD_LABELS[f] || f)}</option>`).join('')}
            </select></label>` : '').join('')}</div>`;
    $('import-mapping').querySelectorAll('.import-field').forEach(sel => sel.addEventListener('change', () => {
        const i = +sel.dataset.col;
        if (sel.value) importState.fields = importState.fields.map((f, j) => (j !== i && f === sel.value ? null : f));
        importState.fields[i] = sel.value || null;
        analyzeImport({ keepFields: true });
    }));
};

const importKocPaste = () => {
    const r = analyzeImport({ keepFields: !!importState.fields });
    if (!r) return showToast('Chưa có dữ liệu: chọn file hoặc dán bảng', 'error');
    if (r.error || !r.records.length) return showToast(r.error || 'Không đọc được dòng nào', 'error');
    const target = $('import-target').value;
    if (target === 'blacklist') {
        const existing = getBlacklistEntries();
        const key = (e) => KM.handleFromLink(e.link) || normalizeName(e.name);
        const index = new Map(existing.map((e, i) => [key(e), i]));
        let added = 0, updated = 0;
        r.records.forEach(e => {
            const i = index.get(key(e));
            if (i !== undefined) { existing[i] = { ...existing[i], ...Object.fromEntries(Object.entries(e).filter(([k, v]) => v && k !== 'id')) }; updated++; }
            else { existing.push(e); index.set(key(e), existing.length - 1); added++; }
        });
        setBlacklistEntries(existing.slice());
        renderBlacklistTable();
        renderKocTable();
        showToast(`Blacklist: thêm ${added}, cập nhật ${updated}`);
    } else {
        const { added, updated } = upsertKocs(r.records);
        renderKocTable();
        refreshBriefEmptyState();
        showToast(`Đã nhập ${added} KOC mới, cập nhật ${updated} KOC`);
    }
    closeModal('paste');
};

// ================= BLACKLIST UI =================
const renderBlacklistTable = () => {
    const list = getBlacklistEntries();
    $('blacklist-count').textContent = list.length;
    $('blacklist-tbody').innerHTML = list.length ? list.map(e => `<tr>
        <td>${escapeHtml(e.name)}</td>
        <td class="text-xs">${e.link ? `<a href="${escapeHtml(e.link)}" target="_blank" rel="noopener noreferrer" class="hover:text-brand-400">${escapeHtml(e.link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40))}</a>` : '-'}</td>
        <td class="text-xs">${escapeHtml(e.project || '')}</td>
        <td class="text-xs text-gray-400">${escapeHtml(e.reason || '')}</td>
        <td class="text-right"><button onclick="deleteBlacklistEntry('${escapeHtml(e.id)}')" class="text-gray-500 hover:text-red-500" title="Xóa"><i class="fas fa-times"></i></button></td>
    </tr>`).join('') : '<tr><td colspan="5" class="text-center text-gray-500 italic py-4">Chưa có KOL nào trong blacklist.</td></tr>';
};

const addBlacklistEntry = () => {
    const name = $('bl-new-name').value.trim();
    const link = $('bl-new-link').value.trim();
    if (!name && !link) return showToast('Nhập tên hoặc link kênh', 'error');
    const e = KM.normalizeBlacklistEntry({ name, link, reason: $('bl-new-reason').value.trim() });
    setBlacklistEntries([...getBlacklistEntries(), stampNew(e)]);
    ['bl-new-name', 'bl-new-link', 'bl-new-reason'].forEach(id => { $(id).value = ''; });
    renderBlacklistTable();
    renderKocTable();
    checkBlacklist();
    showToast(`Đã thêm "${name || link}" vào blacklist`);
};

const deleteBlacklistEntry = (id) => {
    const e = getBlacklistEntries().find(x => x.id === id);
    if (!e || !confirm(`Bỏ "${e.name || e.link}" khỏi blacklist?`)) return;
    setBlacklistEntries(getBlacklistEntries().filter(x => x.id !== id));
    renderBlacklistTable();
    renderKocTable();
    checkBlacklist();
};

const downloadText = (filename, text, type = 'text/csv;charset=utf-8') => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
};

const exportKocCsv = () => {
    if (!kocs.length) return showToast('Kho KOC đang trống', 'error');
    downloadText(`kho-koc-${new Date().toISOString().slice(0, 10)}.csv`, KM.exportKocsToCsv(kocs));
};

const downloadKocTemplate = () => {
    const sample = KM.normalizeKoc({ name: 'Tên KOC', platform: 'TikTok', link: 'https://www.tiktok.com/@ten_kenh', contact: '09xx xxx xxx', followers: 120000, avgViews: 40000, er: 6.5, categories: ['beauty'], gender: 'nu', ages: ['18-24', '25-34'], location: 'TP.HCM', rate: 8000000, taxType: 'PIT', rating: 4, notes: 'Review chân thật, hay làm unbox' });
    downloadText('mau-kho-koc.csv', KM.exportKocsToCsv([sample]));
};

/** Save the KOC currently in the Proceed Internal form into the KOC database. */
const saveKocFromInternal = () => {
    const name = $('pnl-name').value.trim();
    if (!name) return showToast('Chưa có tên KOC', 'error');
    const k = KM.normalizeKoc({
        name, link: $('pnl-link').value, contact: $('pnl-contact').value, followers: $('pnl-followers').value,
        platform: $('pnl-platform').value, rate: $('pnl-cost').value, taxType: $('pnl-tax-type').value,
    });
    const { added } = upsertKocs([k]);
    showToast(added ? `Đã thêm "${name}" vào Kho KOC. Vào Kho KOC để bổ sung ngành, khán giả.` : `Đã cập nhật "${name}" trong Kho KOC`);
};

// ================= DEMO DATA =================
// Fictional KOCs for trying the tool. Names are clearly marked and links are left empty on purpose.
const DEMO_KOCS = [
    ['[Mẫu] Vy Skincare', 'TikTok', 180000, 65000, 7.2, 'beauty', 'nu', '18-24,25-34', 'TP.HCM', 9000000, 5, 'Review skincare chân thật, da dầu mụn'],
    ['[Mẫu] Ngọc Makeup Daily', 'TikTok', 450000, 120000, 5.1, 'beauty,fashion', 'nu', '18-24', 'Hà Nội', 18000000, 4, 'Makeup tutorial, trend'],
    ['[Mẫu] Hà Mẹ Bỉm', 'FB', 95000, 20000, 4.0, 'mombaby,home', 'nu', '25-34', 'Hà Nội', 6000000, 4, 'Chia sẻ nuôi con, review đồ gia dụng'],
    ['[Mẫu] Tú Ăn Gì', 'TikTok', 820000, 300000, 6.8, 'fnb,entertainment', 'all', '18-24,25-34', 'TP.HCM', 25000000, 5, 'Review quán ăn, hài hước'],
    ['[Mẫu] Bếp Nhà Lan', 'YT', 260000, 45000, 3.5, 'fnb,home', 'nu', '25-34,35-44', 'Toàn quốc', 12000000, 3, 'Nấu ăn gia đình'],
    ['[Mẫu] Khoa Tech Review', 'YT', 640000, 90000, 3.2, 'tech', 'nam', '18-24,25-34', 'Toàn quốc', 30000000, 4, 'Đánh giá điện thoại, laptop'],
    ['[Mẫu] Minh Gaming', 'TikTok', 1500000, 400000, 8.5, 'game,entertainment', 'nam', '13-17,18-24', 'Toàn quốc', 40000000, 4, 'Liên Quân, Free Fire'],
    ['[Mẫu] Thảo Đi Đâu', 'TikTok', 75000, 30000, 9.1, 'travel,fnb', 'nu', '18-24,25-34', 'Đà Nẵng', 4000000, 5, 'Du lịch miền Trung, check-in'],
    ['[Mẫu] An Fitness', 'TikTok', 220000, 50000, 5.5, 'health', 'all', '18-24,25-34', 'TP.HCM', 10000000, 4, 'Gym, dinh dưỡng, giảm cân'],
    ['[Mẫu] Quân Tài Chính', 'FB', 310000, 40000, 2.8, 'app,education', 'nam', '25-34,35-44', 'Hà Nội', 15000000, 3, 'Đầu tư, quản lý tài chính cá nhân'],
    ['[Mẫu] Mai Outfit', 'Threads', 40000, 15000, 6.0, 'fashion', 'nu', '18-24', 'TP.HCM', 3000000, 4, 'OOTD, phối đồ sinh viên'],
    ['[Mẫu] Hùng Xe Cộ', 'YT', 380000, 70000, 4.2, 'auto,tech', 'nam', '25-34,35-44', 'Toàn quốc', 20000000, 4, 'Review ô tô, xe điện'],
    ['[Mẫu] Linh Unbox', 'TikTok', 55000, 25000, 10.2, 'beauty,home', 'nu', '18-24,25-34', 'Cần Thơ', 3500000, 4, 'Unbox, review chân thật, giá rẻ'],
    ['[Mẫu] Boss Mập', 'TikTok', 300000, 150000, 11.0, 'pet,entertainment', 'all', '18-24,25-34', 'Hà Nội', 12000000, 5, 'Mèo béo, nội dung vui nhộn'],
    ['[Mẫu] Cô Giáo Hằng', 'TikTok', 900000, 200000, 4.8, 'education', 'all', '18-24', 'Toàn quốc', 22000000, 4, 'Tiếng Anh giao tiếp, IELTS'],
    ['[Mẫu] Trang Beauty Talk', 'FB', 120000, 15000, 2.0, 'beauty', 'nu', '25-34,35-44', 'Hà Nội', 7000000, 2, 'Livestream mỹ phẩm'],
];
const loadDemoKocs = () => {
    const list = DEMO_KOCS.map(([name, platform, followers, avgViews, er, cats, gender, ages, location, rate, rating, notes]) =>
        KM.normalizeKoc({ name, platform, followers, avgViews, er, categories: cats.split(','), gender, ages, location, rate, rating, notes, taxType: 'PIT', demo: true }));
    const { added } = upsertKocs(list);
    renderKocTable();
    refreshBriefEmptyState();
    showToast(added ? `Đã nạp ${added} KOC mẫu. Xóa bằng nút "Xóa…" khi không cần.` : 'Dữ liệu mẫu đã có sẵn', 'info');
};

// ================= BRIEF =================
const BRIEF_CHIP_FIELDS = [['categories', 'brief-categories'], ['platforms', 'brief-platforms'], ['ages', 'brief-ages'], ['locations', 'brief-locations'], ['tiers', 'brief-tiers']];

const readBriefForm = () => {
    const b = {
        brand: $('brief-brand').value, product: $('brief-product').value, deliverable: $('brief-deliverable').value,
        totalBudget: $('brief-budget').value, kocCount: $('brief-count').value, minER: $('brief-min-er').value,
        gender: $('brief-gender').value, keywords: $('brief-keywords').value.split(','), goal: $('brief-goal').value,
    };
    BRIEF_CHIP_FIELDS.forEach(([f, id]) => { b[f] = getChips(id); });
    return KM.normalizeBrief(b);
};

const fillBriefForm = (b, { onlyFilled = false } = {}) => {
    const setVal = (id, v) => { if (!onlyFilled || (v !== undefined && v !== '' && v !== 0)) $(id).value = v ?? ''; };
    setVal('brief-brand', b.brand);
    setVal('brief-product', b.product);
    setVal('brief-deliverable', b.deliverable);
    setVal('brief-budget', b.totalBudget ? formatMoney(b.totalBudget) : '');
    setVal('brief-count', b.kocCount || '');
    setVal('brief-min-er', b.minER || '');
    setVal('brief-gender', b.gender || '');
    setVal('brief-goal', b.goal || '');
    if (!onlyFilled || (b.keywords && b.keywords.length)) $('brief-keywords').value = (b.keywords || []).join(', ');
    BRIEF_CHIP_FIELDS.forEach(([f, id]) => { if (!onlyFilled || (b[f] && b[f].length)) setChips(id, b[f] || []); });
    saveBriefState();
};

const saveBriefState = () => {
    safeStorage.set(STORAGE.brief, JSON.stringify({ raw: $('brief-raw').value, brief: readBriefForm() }));
    if (window.Hunt) Hunt.render(); // prospect scores depend on the brief
};

const resetBrief = () => {
    if (!confirm('Xóa brief và tiêu chí hiện tại?')) return;
    $('brief-raw').value = '';
    fillBriefForm(KM.normalizeBrief({}));
    $('match-results').classList.add('hidden');
    lastRanking = null;
};

const summarizeParsed = (b) => {
    const parts = [];
    if (b.categories.length) parts.push(b.categories.map(c => labelOf(KM.CATEGORIES, c)).join(', '));
    if (b.platforms.length) parts.push(b.platforms.join(', '));
    if (b.totalBudget) parts.push('NS ' + KM.formatShort(b.totalBudget));
    if (b.kocCount) parts.push(b.kocCount + ' KOC');
    return parts.join(' · ');
};

const parseBriefQuick = () => {
    const raw = $('brief-raw').value.trim();
    if (!raw) return showToast('Hãy dán nội dung brief trước', 'error');
    const b = KM.normalizeBrief(KM.parseBriefText(raw));
    fillBriefForm(b, { onlyFilled: true });
    const s = summarizeParsed(b);
    showToast(s ? `Đã đọc brief: ${s}. Kiểm tra lại tiêu chí nhé.` : 'Không nhận ra tiêu chí nào, hãy điền tay.', s ? 'success' : 'info');
};

const parseBriefWithAI = async () => {
    const raw = $('brief-raw').value.trim();
    if (!raw) return showToast('Hãy dán nội dung brief trước', 'error');
    if (!getApiKey()) {
        showToast('Chưa có Gemini API Key, dùng chế độ đọc nhanh.', 'info');
        return parseBriefQuick();
    }
    const prompt = `Bạn là trợ lý của agency booking KOC. Đọc brief dưới đây và trích xuất tiêu chí. CHỈ trả về một object JSON hợp lệ, không giải thích, không markdown, theo đúng schema:
{
 "brand": string, "product": string,
 "deliverable": string (hạng mục cho MỖI KOC, ví dụ "1 video TikTok 60s"),
 "categories": mảng các giá trị trong [${KM.CATEGORIES.map(c => `"${c.id}" (${c.label})`).join(', ')}],
 "platforms": mảng các giá trị trong ["TikTok","FB","YT","Threads","Instagram"],
 "gender": "nu" | "nam" | "" (giới tính khán giả mục tiêu),
 "ages": mảng các giá trị trong ${JSON.stringify(KM.AGES)},
 "locations": mảng các giá trị trong ${JSON.stringify(KM.LOCATIONS.map(l => l.id))},
 "tiers": mảng các giá trị trong ["nano","micro","mid","macro","mega"],
 "totalBudget": số tiền VND (number, 0 nếu không có),
 "kocCount": number (0 nếu không có),
 "goal": "sales" (bán hàng TikTok Shop / affiliate) | "app" (tải app / chuyển đổi) | "awareness" (nhận diện, ra mắt) | "",
 "minER": number phần trăm (0 nếu không có),
 "keywords": mảng tối đa 5 từ khóa về phong cách nội dung / insight quan trọng
}
Không bịa thông tin không có trong brief (để trống hoặc mảng rỗng).

BRIEF:
"""${raw.slice(0, 8000)}"""`;
    const btn = $('btn-brief-ai');
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang phân tích...';
    try {
        const text = await callGemini(prompt);
        const json = JSON.parse((text.match(/\{[\s\S]*\}/) || ['{}'])[0]);
        // Merge: AI first, rule-based parser fills what AI left empty
        const quick = KM.parseBriefText(raw);
        const merged = { ...quick };
        Object.entries(json).forEach(([k, v]) => { if (v !== '' && v !== 0 && !(Array.isArray(v) && !v.length) && v !== null) merged[k] = v; });
        const b = KM.normalizeBrief(merged);
        fillBriefForm(b, { onlyFilled: true });
        showToast(`AI đã phân tích brief: ${summarizeParsed(b) || 'không có tiêu chí rõ ràng'}`);
    } catch (err) {
        showToast(`AI lỗi (${err.message}). Dùng chế độ đọc nhanh.`, 'error');
        parseBriefQuick();
    } finally {
        btn.disabled = false;
        btn.innerHTML = label;
    }
};

// ================= MATCHING =================
// Same pricing settings as Proceed External; "manual" pricing falls back to the target margin for estimates
const getPricing = () => { const p = getPricingSettings(); return { ...p, mode: p.mode === 'manual' ? 'margin' : p.mode }; };
const matchCtx = () => ({ pricing: getPricing(), isBlacklisted: (k) => !!findBlacklisted(k.name, k.link) });

const scoreColor = (s) => s >= 75 ? 'bg-green-500' : s >= 55 ? 'bg-yellow-500' : 'bg-red-500';
const REASON_STYLE = { good: 'text-green-400 fa-check', warn: 'text-yellow-400 fa-triangle-exclamation', bad: 'text-red-400 fa-xmark', info: 'text-gray-500 fa-circle-info' };

const runMatch = ({ silent = false } = {}) => {
    saveBriefState();
    if (!kocs.length) {
        if (!silent) showToast('Kho KOC đang trống. Nhập KOC hoặc nạp dữ liệu mẫu trước.', 'error');
        refreshBriefEmptyState();
        return null;
    }
    const brief = readBriefForm();
    lastRanking = KM.rankKocs(kocs, brief, matchCtx());
    renderMatchResults(brief);
    renderShortlist();
    if (!silent) {
        $('match-results').classList.remove('hidden');
        $('match-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return lastRanking;
};

const renderMatchResults = (brief) => {
    const { matches, excluded } = lastRanking;
    const good = matches.filter(r => r.score >= 60).length;
    const perKoc = brief.totalBudget && brief.kocCount ? brief.totalBudget / brief.kocCount : 0;
    $('match-summary').innerHTML = `${matches.length} KOC phù hợp điều kiện bắt buộc, <b class="text-white">${good}</b> KOC đạt từ 60 điểm.` +
        (perKoc ? ` Ngân sách trung bình ~<b class="text-white">${formatMoney(perKoc)}</b>/KOC.` : '');
    $('match-list').innerHTML = matches.length ? matches.slice(0, 50).map((r, i) => {
        const k = r.koc;
        const inList = shortlistIds.includes(k.id);
        return `<div class="p-4 rounded-lg border ${inList ? 'border-green-700 bg-green-900/10' : 'border-gray-800 bg-dark-900/50'}">
            <div class="flex flex-wrap gap-3 items-start">
                <div class="w-14 text-center shrink-0">
                    <div class="text-2xl font-bold text-white">${r.score}</div>
                    <div class="h-1.5 rounded bg-dark-700 overflow-hidden"><div class="h-full ${scoreColor(r.score)}" style="width:${r.score}%"></div></div>
                    <div class="text-[10px] text-gray-500 mt-1">#${i + 1}</div>
                </div>
                <div class="flex-1 min-w-[12rem]">
                    <div class="font-semibold text-white">${k.link ? `<a href="${escapeHtml(k.link)}" target="_blank" rel="noopener noreferrer" class="hover:text-brand-400">${escapeHtml(k.name)}</a>` : escapeHtml(k.name)}
                        <span class="text-xs text-gray-400 font-normal ml-1">${escapeHtml(labelOf(KM.PLATFORMS, k.platform))} · ${k.followers ? KM.formatFollowers(k.followers) + ' follower' : 'chưa rõ follower'}${k.er ? ' · ER ' + k.er + '%' : ''}</span></div>
                    <div class="text-xs text-gray-400 mt-0.5">${(k.categories || []).map(c => escapeHtml(labelOf(KM.CATEGORIES, c))).join(', ')}${kocAudienceText(k) ? ' · ' + escapeHtml(kocAudienceText(k)) : ''}</div>
                    <ul class="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                        ${r.reasons.map(x => `<li class="${REASON_STYLE[x.type].split(' ')[0]}"><i class="fas ${REASON_STYLE[x.type].split(' ')[1]} w-4"></i>${escapeHtml(x.text)}</li>`).join('')}
                    </ul>
                </div>
                <div class="text-right shrink-0 space-y-2">
                    <div class="text-xs text-gray-500">Giá bán ƯT</div>
                    <div class="font-bold text-brand-400">${r.price ? formatMoney(r.price) : '—'}</div>
                    <div class="flex gap-1 justify-end flex-wrap">
                        <button onclick="toggleShortlist('${k.id}')" class="px-2 py-1 rounded text-xs ${inList ? 'bg-green-700 text-white' : 'bg-dark-700 text-gray-200 hover:bg-dark-600'}">${inList ? '<i class="fas fa-check"></i> Đã chọn' : '<i class="fas fa-plus"></i> Shortlist'}</button>
                        <button onclick="sendKocToScouting('${k.id}')" class="px-2 py-1 rounded text-xs bg-dark-700 text-gray-200 hover:bg-dark-600" title="Soạn tin xin giá">Xin giá</button>
                        <button onclick="sendKocToPnl('${k.id}')" class="px-2 py-1 rounded text-xs bg-dark-700 text-gray-200 hover:bg-dark-600" title="Đưa vào Proceed Internal">PNL</button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('') + (matches.length > 50 ? `<p class="text-xs text-gray-500">Đang hiển thị 50/${matches.length} KOC điểm cao nhất.</p>` : '')
        : '<p class="text-gray-500 italic">Không có KOC nào thỏa điều kiện bắt buộc. Thử bỏ bớt nền tảng hoặc tăng ngân sách.</p>';
    $('match-excluded-count').textContent = excluded.length;
    $('match-excluded-wrap').classList.toggle('hidden', !excluded.length);
    $('match-excluded').innerHTML = excluded.map(r => `<div>• ${escapeHtml(r.koc.name)} (${escapeHtml(labelOf(KM.PLATFORMS, r.koc.platform))}): ${escapeHtml(r.excluded)}</div>`).join('');
};

// ================= SHORTLIST =================
const toggleShortlist = (id) => {
    shortlistIds = shortlistIds.includes(id) ? shortlistIds.filter(x => x !== id) : [...shortlistIds, id];
    persistShortlist();
    if (lastRanking) renderMatchResults(readBriefForm());
    renderShortlist();
};

const autoPickShortlist = () => {
    if (!lastRanking) runMatch({ silent: true });
    if (!lastRanking) return;
    const brief = readBriefForm();
    const { picked, total } = KM.pickShortlist(lastRanking.matches, brief);
    if (!picked.length) return showToast('Không chọn được KOC nào (điểm thấp hoặc vượt ngân sách)', 'error');
    if (shortlistIds.length && !confirm('Thay shortlist hiện tại bằng danh sách tự chọn?')) return;
    shortlistIds = picked.map(r => r.koc.id);
    persistShortlist();
    renderMatchResults(brief);
    renderShortlist();
    const want = brief.kocCount;
    showToast(`Đã chọn ${picked.length}${want ? '/' + want : ''} KOC, tổng ước tính ${formatMoney(total)}đ` + (want && picked.length < want ? '. Chưa đủ số lượng: cần thêm KOC vào kho hoặc nới tiêu chí.' : ''), want && picked.length < want ? 'info' : 'success');
    $('shortlist-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const getShortlistRows = () => {
    const brief = readBriefForm();
    const ctx = matchCtx();
    return shortlistIds.map(id => kocs.find(k => k.id === id)).filter(Boolean).map(k => KM.scoreKoc(k, brief, ctx));
};

const renderShortlist = () => {
    const rows = getShortlistRows();
    $('shortlist-card').classList.toggle('hidden', !rows.length);
    $('shortlist-count').textContent = rows.length;
    const brief = readBriefForm();
    const total = rows.reduce((s, r) => s + (r.price || 0), 0);
    if (brief.totalBudget) {
        const pct = Math.min(100, total / brief.totalBudget * 100);
        const over = total > brief.totalBudget;
        $('shortlist-budget').innerHTML = `<div class="flex justify-between text-sm mb-1"><span class="text-gray-400">Tổng giá bán ước tính</span><span class="${over ? 'text-red-400' : 'text-white'} font-semibold">${formatMoney(total)} / ${formatMoney(brief.totalBudget)}đ (${Math.round(total / brief.totalBudget * 100)}%)</span></div>
            <div class="h-2 rounded bg-dark-700 overflow-hidden"><div class="h-full ${over ? 'bg-red-500' : 'bg-green-500'}" style="width:${pct}%"></div></div>`;
    } else {
        $('shortlist-budget').innerHTML = `<div class="text-sm text-gray-400">Tổng giá bán ước tính: <b class="text-white">${formatMoney(total)}đ</b></div>`;
    }
    $('shortlist-tbody').innerHTML = rows.map(r => `<tr>
        <td>${escapeHtml(r.koc.name)}${r.excluded ? ` <span class="text-xs text-red-400" title="${escapeHtml(r.excluded)}"><i class="fas fa-triangle-exclamation"></i></span>` : ''}</td>
        <td>${escapeHtml(labelOf(KM.PLATFORMS, r.koc.platform))}</td>
        <td>${r.koc.followers ? KM.formatFollowers(r.koc.followers) : '-'}</td>
        <td><span class="px-2 py-0.5 rounded text-xs text-white ${scoreColor(r.score)}">${r.score}</span></td>
        <td class="whitespace-nowrap text-brand-400">${r.price ? formatMoney(r.price) : '-'}</td>
        <td class="whitespace-nowrap text-right">
            <button onclick="sendKocToScouting('${r.koc.id}')" class="text-xs text-gray-400 hover:text-white px-1" title="Xin giá"><i class="fas fa-comment-dollar"></i></button>
            <button onclick="sendKocToPnl('${r.koc.id}')" class="text-xs text-gray-400 hover:text-white px-1" title="Đưa vào PNL"><i class="fas fa-calculator"></i></button>
            <button onclick="toggleShortlist('${r.koc.id}')" class="text-xs text-gray-500 hover:text-red-500 px-1" title="Bỏ khỏi shortlist"><i class="fas fa-times"></i></button>
        </td></tr>`).join('');
};

const clearShortlist = () => {
    if (!confirm('Xóa toàn bộ shortlist?')) return;
    shortlistIds = [];
    persistShortlist();
    if (lastRanking) renderMatchResults(readBriefForm());
    renderShortlist();
};

/** mode 'brand' hides internal cost; 'internal' includes cost, tax, score and reasons. */
const copyShortlist = (mode) => {
    const rows = getShortlistRows();
    if (!rows.length) return showToast('Shortlist đang trống', 'error');
    const brief = readBriefForm();
    const header = mode === 'brand'
        ? ['STT', 'KOC', 'Nền tảng', 'Link', 'Followers', 'View TB', 'ER (%)', 'Ngành', 'Hạng mục', 'Báo giá']
        : ['STT', 'KOC', 'Nền tảng', 'Link', 'Contact', 'Followers', 'View TB', 'ER (%)', 'Điểm', 'Giá nhập', 'Loại thuế', 'Giá bán ƯT', 'Lý do'];
    const lines = rows.map((r, i) => {
        const k = r.koc;
        const cats = (k.categories || []).map(c => labelOf(KM.CATEGORIES, c)).join(', ');
        return mode === 'brand'
            ? [i + 1, k.name, labelOf(KM.PLATFORMS, k.platform), k.link, k.followers || '', k.avgViews || '', k.er || '', cats, brief.deliverable, formatMoney(r.price)]
            : [i + 1, k.name, labelOf(KM.PLATFORMS, k.platform), k.link, k.contact, k.followers || '', k.avgViews || '', k.er || '', r.score, formatMoney(k.rate), k.taxType, formatMoney(r.price), r.reasons.filter(x => x.type !== 'info').map(x => (x.type === 'good' ? '+ ' : '- ') + x.text).join('; ')];
    });
    copyTextToClipboard([header, ...lines].map(toTsvRow).join('\n'));
};

// ================= HAND-OFF TO BOOKING STEPS =================
const sendKocToScouting = (id) => {
    const k = kocs.find(x => x.id === id);
    if (!k) return;
    const brief = readBriefForm();
    $('blacklist-input').value = k.name;
    checkBlacklist();
    if (brief.brand) $('brand-name').value = brief.brand;
    if (brief.deliverable) $('scope-xin-gia').value = brief.deliverable;
    switchTab('scouting');
    showToast(`Đang soạn tin xin giá cho "${k.name}"`, 'info');
};

const sendKocToPnl = (id) => {
    const k = kocs.find(x => x.id === id);
    if (!k) return;
    const brief = readBriefForm();
    $('pnl-name').value = k.name;
    $('pnl-link').value = k.link || '';
    $('pnl-contact').value = k.contact || '';
    $('pnl-followers').value = k.followers || '';
    $('pnl-payment').value = k.paymentTerm || '';
    if (KM.BACKUP_RATES[k.platform]) $('pnl-platform').value = k.platform;
    else showToast(`Chưa rõ nền tảng của "${k.name}", hãy chọn nền tảng để tính cost backup.`, 'info');
    $('pnl-cost').value = k.rate ? formatMoney(k.rate) : '';
    $('pnl-qty-booking').value = '1';
    $('ext-qty').value = '1';
    $('pnl-tax-type').value = k.taxType || 'PIT';
    $('pnl-kpi').value = '';
    $('pnl-kpi-eng').value = '';
    $('pnl-scope').value = brief.deliverable || k.scope || '';
    $('blacklist-input').value = k.name;
    checkBlacklist();
    refreshCalculations();
    switchTab('internal');
    showToast(`Đã điền "${k.name}" vào Proceed Internal${k.lastQuote ? ` (giá bán lần trước: ${formatMoney(k.lastQuote)})` : ''}. Nhập KPI commit để tính cost backup.`, 'info');
};

// ================= INIT =================
const refreshBriefEmptyState = () => $('brief-empty-db').classList.toggle('hidden', kocs.length > 0);

window.onTabShown = (id) => {
    if (id === 'kocs') { renderKocTable(); renderBlacklistTable(); }
    if (id === 'db') renderTeamStats();
    if (id === 'brief') { refreshBriefEmptyState(); renderOnboarding(); if (window.Hunt) Hunt.render(); if (lastRanking) runMatch({ silent: true }); }
};

document.addEventListener('DOMContentLoaded', () => {
    renderChips('brief-categories', CATEGORY_OPTS, [], saveBriefState);
    renderChips('brief-platforms', PLATFORM_OPTS, [], saveBriefState);
    renderChips('brief-ages', AGE_OPTS, [], saveBriefState);
    renderChips('brief-locations', LOCATION_OPTS, [], saveBriefState);
    renderChips('brief-tiers', TIER_OPTS, [], saveBriefState);
    renderChips('koc-categories', CATEGORY_OPTS);
    renderChips('koc-ages', AGE_OPTS);
    $('koc-platform').innerHTML = PLATFORM_OPTS.map(o => `<option value="${o.id}">${o.label}</option>`).join('');
    $('koc-location-list').innerHTML = KM.LOCATIONS.map(l => `<option value="${l.id}"></option>`).join('');
    renderKocFilters();

    let t;
    $('paste-text').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { importState.workbook = null; $('import-sheet-wrap').classList.add('hidden'); analyzeImport(); }, 250); });
    document.querySelectorAll('.brief-field').forEach(el => el.addEventListener('change', saveBriefState));
    $('brief-raw').addEventListener('change', saveBriefState);
    ['koc-followers', 'koc-views'].forEach(id => $(id).addEventListener('blur', (e) => {
        const n = KM.parseNumber(e.target.value);
        if (!isNaN(n)) e.target.value = String(Math.round(n));
    }));

    const saved = safeStorage.getJSON(STORAGE.brief, null);
    if (saved && saved.brief) {
        $('brief-raw').value = saved.raw || '';
        fillBriefForm(saved.brief);
    }
    renderKocTable();
    refreshBriefEmptyState();
    if (shortlistIds.length && kocs.length) runMatch({ silent: true });
    if (lastRanking && saved && saved.brief) $('match-results').classList.remove('hidden');
});
