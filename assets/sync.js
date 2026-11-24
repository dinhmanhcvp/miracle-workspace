'use strict';
/*
 * Team sync with a Google Sheet through a Google Apps Script web app (apps-script/Code.gs).
 * - Every local change is detected by comparing with the last snapshot (no need to touch each edit path).
 * - Records carry id + updatedAt; the newest version wins (server side and client side).
 * - Deletions are sent as tombstones (deleted = TRUE in the Sheet) so other clients drop them too.
 * Depends on app.js (storage, PNL/report state, blacklist), koc.js (kocs) and matcher.js.
 */
// Captured before app.js rewrites the hash on startup
const INITIAL_JOIN_HASH = location.hash;

window.Sync = (() => {
    const KM = KocMatcher;
    const nowIso = () => new Date().toISOString();
    const catLabel = (id) => (KM.CATEGORIES.find(c => c.id === id) || {}).label || id;
    const genderLabel = (g) => ({ nu: 'Nữ', nam: 'Nam', all: 'Cân bằng' }[g] || '');
    const pick = (row, h) => (row && row[h] !== undefined && row[h] !== null ? row[h] : '');

    // ---- Collections: how to read/write local state and map to Sheet columns ----
    const COLLECTIONS = {
        kocs: {
            label: 'Kho KOC',
            list: () => kocs.filter(k => !k.demo),
            replace: (list) => { const demo = kocs.filter(k => k.demo); kocs = [...list, ...demo]; persistKocs({ track: false }); },
            columns: [
                ['Tên', k => k.name], ['Nền tảng', k => k.platform], ['Link', k => k.link], ['Contact', k => k.contact],
                ['Followers', k => k.followers || ''], ['View TB', k => k.avgViews || ''], ['ER (%)', k => k.er || ''],
                ['Nhóm / Ngành', k => (k.categories || []).map(catLabel).join(', ')], ['Giới tính khán giả', k => genderLabel(k.gender)],
                ['Độ tuổi khán giả', k => (k.ages || []).join(', ').replace(/-/g, '–')], ['Khu vực', k => k.location], ['Giá nhập', k => k.rate || ''],
                ['Giá bán gần nhất', k => k.lastQuote || ''], ['Loại thuế', k => k.taxType], ['Hạng mục công việc', k => k.scope],
                ['Đánh giá', k => k.rating || ''], ['Payment term', k => k.paymentTerm], ['Trạng thái', k => k.status === 'inactive' ? 'Tạm ngưng' : 'Đang hợp tác'],
                ['Ghi chú', k => k.notes],
            ],
            fromSheet: (data, row) => KM.normalizeKoc({
                ...(data || {}),
                name: pick(row, 'Tên'), platform: pick(row, 'Nền tảng'), link: pick(row, 'Link'), contact: pick(row, 'Contact'),
                followers: pick(row, 'Followers'), avgViews: pick(row, 'View TB'), er: pick(row, 'ER (%)'), categories: pick(row, 'Nhóm / Ngành'),
                gender: pick(row, 'Giới tính khán giả'), ages: pick(row, 'Độ tuổi khán giả'), location: pick(row, 'Khu vực'), rate: pick(row, 'Giá nhập'),
                lastQuote: pick(row, 'Giá bán gần nhất'), taxType: pick(row, 'Loại thuế'), scope: pick(row, 'Hạng mục công việc'), rating: pick(row, 'Đánh giá'),
                paymentTerm: pick(row, 'Payment term'), status: /ngưng|inactive/i.test(String(pick(row, 'Trạng thái'))) ? 'inactive' : 'active',
                notes: pick(row, 'Ghi chú'), demo: false,
            }),
        },
        blacklist: {
            label: 'Blacklist',
            list: () => getBlacklistEntries(),
            replace: (list) => setBlacklistEntries(list, { track: false }),
            columns: [['Tên', e => e.name], ['Link', e => e.link], ['Dự án', e => e.project], ['Lý do', e => e.reason]],
            fromSheet: (data, row) => KM.normalizeBlacklistEntry({ ...(data || {}), name: pick(row, 'Tên'), link: pick(row, 'Link'), project: pick(row, 'Dự án'), reason: pick(row, 'Lý do') }),
        },
        pnl: {
            label: 'Kho PNL',
            list: () => savedPNL,
            replace: (list) => { savedPNL = list; persistPnl({ track: false }); },
            // Numbers are computed by the tool: the Sheet copy is for reading; text fields edited in the Sheet are synced back.
            columns: [
                ['Tên', p => p.name], ['Contact', p => p.contact], ['Link kênh', p => p.link], ['Followers', p => p.followers], ['Hạng mục công việc', p => p.scope],
                ['Chi phí (A)', p => p.A], ['Số lượng (B)', p => p.B], ['Đơn vị tính', p => p.unit], ['Giảm giá (C)', p => p.C], ['Thành tiền (D)', p => p.D],
                ['Đơn giá booking (X)', p => p.X], ['Số lượng booking (O)', p => p.O], ['Total cost (E)', p => p.E], ['Thuế booking (F)', p => p.F],
                ['CB (G)', p => p.G], ['Thuế CB (H)', p => p.H], ['Cost backup (M)', p => p.M], ['Lợi nhuận gộp (K)', p => p.K], ['Margin (L)', p => p.L],
                ['Loại thuế (Y)', p => p.taxType], ['KPI View', p => p.kpiView || ''], ['CPV', p => p.CPV || ''], ['KPI Engagement', p => p.kpiEng || ''],
                ['CPE', p => p.CPE || ''], ['Nền tảng', p => p.platform], ['Payment term', p => p.paymentTerm],
            ],
            fromSheet: (data, row) => upgradePnlRecord({
                ...(data || {}),
                name: pick(row, 'Tên') || (data || {}).name, contact: pick(row, 'Contact'), link: pick(row, 'Link kênh'),
                scope: pick(row, 'Hạng mục công việc'), paymentTerm: pick(row, 'Payment term'),
            }),
        },
        config: {
            label: 'Cấu hình',
            list: () => { const c = getAgencyConfig(); return c.updatedAt || safeStorage.get(CONFIG_KEY, null) ? [c] : []; },
            replace: (list) => { if (list[0]) setAgencyConfig(list[0], { track: false }); },
            columns: [['Mục', () => 'Cấu hình agency (sửa trong tool)'], ['Tên agency', c => c.agencyName], ['Margin mặc định (%)', c => c.pricing.pct],
                ['Giảm giá (%)', c => c.pricing.discountPct], ['Phí CB (%)', c => c.pricing.cbPct]],
            fromSheet: (data, row) => normalizeAgencyConfig({ ...(data || {}), agencyName: pick(row, 'Tên agency') || (data || {}).agencyName || '' }),
        },
        reports: {
            label: 'Báo cáo tuần',
            list: () => savedReports,
            replace: (list) => { savedReports = list; persistReports({ track: false }); },
            columns: [['Client', r => r.client], ['Campaign', r => r.camp], ['Status', r => r.status], ['Margin Before', r => r.marginBefore],
                ['Margin After', r => r.marginAfter], ['Kết quả', r => r.result], ['Lỗi sai', r => r.error]],
            fromSheet: (data, row) => ({
                ...(data || {}), client: String(pick(row, 'Client')), camp: String(pick(row, 'Campaign')), status: String(pick(row, 'Status')),
                marginBefore: String(pick(row, 'Margin Before')), marginAfter: String(pick(row, 'Margin After')),
                result: String(pick(row, 'Kết quả')), error: String(pick(row, 'Lỗi sai')),
            }),
        },
    };
    // Columns stored as plain text in the Sheet (keeps leading zeros of phone numbers, "18–24", links...)
    const TEXT_COLUMNS = {config: ["Mục", "Tên agency"], kocs: ["Tên", "Nền tảng", "Link", "Contact", "Nhóm / Ngành", "Giới tính khán giả", "Độ tuổi khán giả", "Khu vực", "Loại thuế", "Hạng mục công việc", "Payment term", "Trạng thái", "Ghi chú"], blacklist: ["Tên", "Link", "Dự án", "Lý do"], pnl: ["Tên", "Contact", "Link kênh", "Followers", "Hạng mục công việc", "Đơn vị tính", "Loại thuế (Y)", "Nền tảng", "Payment term"], reports: ["Client", "Campaign", "Status", "Margin Before", "Margin After", "Kết quả", "Lỗi sai"]};
    const NAMES = Object.keys(COLLECTIONS);

    // ---- Persistent sync state ----
    const emptyState = () => ({ snapshots: {}, dirty: {}, tombstones: {}, synced: {}, lastSync: null });
    let state = Object.assign(emptyState(), safeStorage.getJSON(STORAGE.syncState, {}) || {});
    NAMES.forEach(c => { ['snapshots', 'tombstones', 'synced'].forEach(k => { state[k][c] = state[k][c] || {}; }); state.dirty[c] = state.dirty[c] || []; });
    const saveState = () => safeStorage.set(STORAGE.syncState, JSON.stringify(state));

    const config = () => safeStorage.getJSON(STORAGE.sync, null) || {};
    const isConfigured = () => { const c = config(); return !!(c.url && c.token); };

    // Content used to detect a change (timestamps and derived strings excluded)
    const fingerprint = (rec) => { const { updatedAt, updatedBy, rawString, savedAt, ...rest } = rec; return JSON.stringify(rest); };

    let paused = false;
    let pushTimer = null;
    let busy = false;
    let lastError = '';

    /** Called after every local save: stamp changed records, record deletions, schedule a push. */
    const changed = (coll) => {
        if (paused || !COLLECTIONS[coll]) return;
        const def = COLLECTIONS[coll];
        const list = def.list();
        const snap = state.snapshots[coll];
        const dirty = new Set(state.dirty[coll]);
        const user = config().user || '';
        let stamped = false;
        const seen = new Set();
        list.forEach(rec => {
            if (!rec.id) rec.id = coll[0] + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            seen.add(rec.id);
            const fp = fingerprint(rec);
            if (snap[rec.id] !== fp) {
                rec.updatedAt = nowIso();
                if (user) rec.updatedBy = user;
                snap[rec.id] = fp;
                dirty.add(rec.id);
                stamped = true;
            }
        });
        Object.keys(snap).forEach(id => {
            if (!seen.has(id)) { delete snap[id]; state.tombstones[coll][id] = nowIso(); dirty.add(id); }
        });
        state.dirty[coll] = Array.from(dirty);
        if (stamped) def.replace(list.slice());
        saveState();
        if (isConfigured()) {
            clearTimeout(pushTimer);
            pushTimer = setTimeout(() => syncNow(), 1500);
            setStatus('pending');
        }
    };

    const snapshotAll = () => {
        NAMES.forEach(c => {
            const snap = {};
            COLLECTIONS[c].list().forEach(r => { if (r.id) snap[r.id] = fingerprint(r); });
            state.snapshots[c] = snap;
        });
        saveState();
    };

    // ---- Network ----
    const call = async (method, payload) => {
        const c = config();
        if (!c.url || !c.token) throw new Error('Chưa cấu hình đồng bộ');
        let res;
        if (method === 'GET') {
            const u = new URL(c.url);
            Object.entries({ ...payload, token: c.token }).forEach(([k, v]) => u.searchParams.set(k, v));
            res = await fetch(u.toString(), { method: 'GET', redirect: 'follow' });
        } else {
            // text/plain avoids a CORS preflight, which Apps Script does not answer
            res = await fetch(c.url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, token: c.token, user: c.user || '' }) });
        }
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { throw new Error(/<html/i.test(text) ? 'Web App chưa mở quyền "Anyone" hoặc URL sai' : 'Phản hồi không hợp lệ'); }
        if (!data.ok) throw new Error(data.error === 'UNAUTHORIZED' ? 'Sai mã bí mật (token)' : (data.error || 'Lỗi máy chủ'));
        return data;
    };

    /** Merge server records into local state (newest updatedAt wins; unsynced local edits are kept). */
    const mergePulled = (coll, serverRecs) => {
        const def = COLLECTIONS[coll];
        const local = def.list().slice();
        const byId = new Map(local.map((r, i) => [r.id, i]));
        const dirty = new Set(state.dirty[coll]);
        const tomb = state.tombstones[coll];
        const synced = state.synced[coll];
        const serverIds = new Set();
        const removeIdx = new Set();
        let changes = 0;
        serverRecs.forEach(s => {
            serverIds.add(s.id);
            synced[s.id] = 1;
            const i = byId.get(s.id);
            const l = i === undefined ? null : local[i];
            if (s.deleted) {
                if (l && !(dirty.has(s.id) && (l.updatedAt || '') > s.updatedAt)) { removeIdx.add(i); changes++; }
                delete tomb[s.id];
                if (!l || removeIdx.has(i)) dirty.delete(s.id);
                return;
            }
            if (!l) {
                if (tomb[s.id] && tomb[s.id] >= s.updatedAt) return; // deleted here, deletion not pushed yet
                const rec = { ...def.fromSheet(s.data, s.row), id: s.id, updatedAt: s.updatedAt, updatedBy: s.updatedBy };
                local.push(rec);
                byId.set(rec.id, local.length - 1);
                changes++;
                return;
            }
            if (dirty.has(s.id) && (l.updatedAt || '') >= s.updatedAt) return; // our newer edit will be pushed
            if (s.updatedAt > (l.updatedAt || '') || !dirty.has(s.id)) {
                const rec = { ...def.fromSheet(s.data, s.row), id: s.id, updatedAt: s.updatedAt, updatedBy: s.updatedBy };
                if (fingerprint(rec) !== fingerprint(l) || rec.updatedAt !== l.updatedAt) { local[i] = rec; changes++; }
                dirty.delete(s.id);
            }
        });
        // Rows that were on the server before but are gone now (deleted by hand in the Sheet)
        local.forEach((r, i) => { if (synced[r.id] && !serverIds.has(r.id) && !dirty.has(r.id)) { removeIdx.add(i); delete synced[r.id]; changes++; } });
        state.dirty[coll] = Array.from(dirty);
        if (changes) {
            const next = local.filter((_, i) => !removeIdx.has(i));
            def.replace(next);
            const snap = {};
            next.forEach(r => { snap[r.id] = fingerprint(r); });
            state.snapshots[coll] = snap;
        }
        return changes;
    };

    const buildPush = () => {
        const changes = {};
        const headers = {};
        const textHeaders = {};
        let count = 0;
        NAMES.forEach(coll => {
            const def = COLLECTIONS[coll];
            const ids = state.dirty[coll];
            if (!ids.length) return;
            const byId = new Map(def.list().map(r => [r.id, r]));
            headers[coll] = def.columns.map(c => c[0]);
            textHeaders[coll] = TEXT_COLUMNS[coll] || [];
            changes[coll] = ids.map(id => {
                const r = byId.get(id);
                if (!r) return state.tombstones[coll][id] ? { id, deleted: true, updatedAt: state.tombstones[coll][id] } : null;
                const data = { ...r };
                delete data.rawString;
                if (data.analysis && JSON.stringify(data).length > 40000) data.analysis = { ...data.analysis, transcripts: [] };
                const row = {};
                def.columns.forEach(([h, fn]) => { const v = fn(r); row[h] = v === undefined || v === null ? '' : v; });
                return { id, updatedAt: r.updatedAt || nowIso(), data, row };
            }).filter(Boolean);
            count += changes[coll].length;
        });
        return { changes, headers, textHeaders, count };
    };

    const rerender = () => {
        try { renderKocTable(); } catch (e) { }
        try { renderBlacklistTable(); } catch (e) { }
        try { renderDbTables(); } catch (e) { }
        try { refreshBriefEmptyState(); } catch (e) { }
        try { checkBlacklist(); } catch (e) { }
        try { if (currentTabId === 'config') renderConfigTab(); } catch (e) { }
        try { renderOnboarding(); } catch (e) { }
    };

    /** Pull, merge, then push local changes. */
    const syncNow = async (manual = false) => {
        if (!isConfigured()) { if (manual) openModal('settings'); return false; }
        if (busy) return false;
        busy = true;
        setStatus('syncing');
        try {
            const firstSync = !state.lastSync;
            const pulled = await call('GET', { action: 'pull' });
            if (firstSync) {
                // first connection: everything local that the server does not have must be uploaded
                NAMES.forEach(c => {
                    const onServer = new Set((pulled.data[c] || []).map(r => r.id));
                    const d = new Set(state.dirty[c]);
                    COLLECTIONS[c].list().forEach(r => { if (!onServer.has(r.id)) { r.updatedAt = r.updatedAt || nowIso(); d.add(r.id); } });
                    state.dirty[c] = Array.from(d);
                });
            }
            let changes = 0;
            NAMES.forEach(c => { changes += mergePulled(c, pulled.data[c] || []); });
            const { changes: push, headers, textHeaders, count } = buildPush();
            if (count) {
                const res = await call('POST', { action: 'push', changes: push, headers, textHeaders });
                let rejected = 0;
                NAMES.forEach(c => {
                    const r = res.results[c];
                    if (!r) return;
                    const acc = new Set(r.accepted);
                    state.dirty[c] = state.dirty[c].filter(id => !acc.has(id));
                    r.accepted.forEach(id => { if (state.tombstones[c][id]) { delete state.tombstones[c][id]; delete state.synced[c][id]; } else state.synced[c][id] = 1; });
                    rejected += r.rejected.length;
                    // server has a newer version: take it on the next pull
                    state.dirty[c] = state.dirty[c].filter(id => !r.rejected.includes(id));
                });
                if (rejected) setTimeout(() => syncNow(), 300);
            }
            state.lastSync = nowIso();
            saveState();
            lastError = '';
            if (changes) rerender();
            setStatus('ok');
            if (manual) showToast(`Đã đồng bộ với Google Sheet${changes ? ` (${changes} thay đổi từ team)` : ''}`);
            return true;
        } catch (err) {
            lastError = err.message;
            saveState();
            setStatus('error');
            if (manual) showToast('Đồng bộ lỗi: ' + err.message, 'error');
            return false;
        } finally {
            busy = false;
        }
    };

    // ---- UI ----
    const setStatus = (kind) => {
        const el = $('sync-status-text');
        if (!el) return;
        const icon = $('sync-status').querySelector('i');
        const time = state.lastSync ? new Date(state.lastSync).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
        const map = {
            off: ['fa-cloud', 'text-gray-500', 'Dữ liệu chỉ lưu trên trình duyệt này'],
            pending: ['fa-cloud-arrow-up', 'text-yellow-500', 'Có thay đổi chưa đồng bộ'],
            syncing: ['fa-rotate fa-spin', 'text-blue-400', 'Đang đồng bộ...'],
            ok: ['fa-cloud', 'text-green-500', `Đã đồng bộ Google Sheet ${time}`],
            error: ['fa-triangle-exclamation', 'text-red-500', `Lỗi đồng bộ: ${lastError}`],
        };
        const [ic, color, text] = map[kind] || map.off;
        icon.className = `fas ${ic} ${color}`;
        el.textContent = text;
    };

    const fillSettings = () => {
        const c = config();
        $('sync-url').value = c.url || '';
        $('sync-token').value = c.token || '';
        $('sync-user').value = c.user || '';
        $('sync-test-result').textContent = '';
    };

    const readSettingsForm = () => ({ url: $('sync-url').value.trim(), token: $('sync-token').value.trim(), user: $('sync-user').value.trim() });

    const saveSettings = () => {
        const prev = config();
        const next = readSettingsForm();
        if (!next.url && !next.token) { safeStorage.remove(STORAGE.sync); setStatus('off'); return; }
        safeStorage.set(STORAGE.sync, JSON.stringify(next));
        if (prev.url !== next.url) { state = { ...emptyState(), snapshots: state.snapshots }; NAMES.forEach(c => { state.dirty[c] = []; state.tombstones[c] = {}; state.synced[c] = {}; }); saveState(); }
        if (next.url && next.token) syncNow(true);
    };

    const testConnection = async () => {
        const out = $('sync-test-result');
        const form = readSettingsForm();
        if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(form.url)) { out.textContent = '⚠️ URL phải là Web App của Apps Script (https://script.google.com/...)'; return; }
        const saved = safeStorage.get(STORAGE.sync, null);
        safeStorage.set(STORAGE.sync, JSON.stringify(form));
        out.textContent = 'Đang kiểm tra...';
        try {
            const r = await call('GET', { action: 'ping' });
            out.textContent = `✅ Kết nối được với "${r.sheet}"`;
        } catch (err) {
            out.textContent = '❌ ' + err.message;
        } finally {
            if (saved === null) safeStorage.remove(STORAGE.sync); else safeStorage.set(STORAGE.sync, saved);
        }
    };

    const disconnect = () => {
        if (!confirm('Ngắt đồng bộ? Dữ liệu trên máy này vẫn giữ nguyên, Google Sheet không bị xóa.')) return;
        safeStorage.remove(STORAGE.sync);
        state = emptyState();
        NAMES.forEach(c => { state.snapshots[c] = {}; state.dirty[c] = []; state.tombstones[c] = {}; state.synced[c] = {}; });
        snapshotAll();
        fillSettings();
        setStatus('off');
    };

    // ---- Invite links: the lead shares one link, members open it and type their name ----
    const toB64url = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const fromB64url = (s) => { const b = s.replace(/-/g, '+').replace(/_/g, '/'); return decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4)))); };
    const buildInviteLink = () => {
        const c = config();
        if (!c.url || !c.token) return '';
        // in the #fragment: never sent to the web host
        return `${location.href.split('#')[0].split('?')[0]}#join=${toB64url(JSON.stringify({ v: 1, url: c.url, token: c.token, agency: rawAgencyName() }))}`;
    };
    let pendingJoin = null;
    const parseJoin = (hash) => {
        const m = String(hash || '').match(/^#join=([A-Za-z0-9_-]+)$/);
        if (!m) return null;
        try { const j = JSON.parse(fromB64url(m[1])); return j && j.url && j.token ? j : null; } catch (e) { return null; }
    };
    const openJoin = (invite) => {
        pendingJoin = invite;
        $('join-agency').textContent = invite.agency || 'team';
        $('join-name').value = config().user || '';
        const c = config();
        $('join-warning').textContent = c.url && c.url !== invite.url ? 'Máy này đang kết nối một team khác; tham gia sẽ chuyển sang team mới.' : '';
        openModal('join');
        setTimeout(() => $('join-name').focus(), 50);
    };
    const joinTeam = async () => {
        if (!pendingJoin) return;
        const user = $('join-name').value.trim();
        if (!user) return showToast('Nhập tên của bạn để team biết ai làm gì', 'error');
        const prev = config();
        safeStorage.set(STORAGE.sync, JSON.stringify({ url: pendingJoin.url, token: pendingJoin.token, user }));
        if (prev.url !== pendingJoin.url) { state = emptyState(); NAMES.forEach(c => { state.snapshots[c] = {}; state.dirty[c] = []; state.tombstones[c] = {}; state.synced[c] = {}; }); saveState(); }
        pendingJoin = null;
        closeModal('join');
        const ok = await syncNow(true);
        if (ok) {
            rerender();
            try { renderSidebar(); switchTab(currentTabId); } catch (e) { }
            showToast(`Chào ${user}! Đã vào team ${rawAgencyName() || ''}. Tiếp theo: cài bookmark "Phân tích KOC".`);
        }
    };

    // Used by the in-app test suite so test data never reaches the team Sheet
    const pause = () => { paused = true; clearTimeout(pushTimer); return { state: JSON.parse(JSON.stringify(state)) }; };
    const resume = (snap) => { paused = false; if (snap && snap.state) { state = snap.state; saveState(); } snapshotAll(); };

    document.addEventListener('DOMContentLoaded', () => {
        const invite = parseJoin(INITIAL_JOIN_HASH);
        if (invite) { try { history.replaceState(null, '', location.pathname + '#brief'); } catch (e) { } setTimeout(() => openJoin(invite), 0); }
        // runs after app.js / koc.js init (registration order)
        if (!state.lastSync) snapshotAll();
        else {
            // detect edits made while offline / before this load
            NAMES.forEach(c => { if (!Object.keys(state.snapshots[c]).length) snapshotAll(); });
        }
        setStatus(isConfigured() ? (state.dirty && NAMES.some(c => state.dirty[c].length) ? 'pending' : 'ok') : 'off');
        if (isConfigured()) {
            syncNow();
            setInterval(() => { if (!document.hidden) syncNow(); }, 60000);
            window.addEventListener('focus', () => syncNow());
        }
    });

    return { changed, syncNow, fillSettings, saveSettings, testConnection, disconnect, pause, resume, isConfigured, buildInviteLink, joinTeam, COLLECTIONS, _state: () => state };
})();
