'use strict';
/*
 * License check (ECDSA P-256 signatures verified with WebCrypto).
 * Key format: base64url(JSON payload) + "." + base64url(signature)
 * Payload: { v, id, agency, plan, iat, exp, domains? }
 * This is a deterrent for a client-side tool, not DRM: anyone who edits the code can bypass it.
 * Licensing is disabled while assets/license-key.js has no public key.
 */
window.License = (() => {
    const TRIAL_DAYS = 14;
    const pub = window.LICENSE_PUBLIC_KEY || null;
    const vendor = window.LICENSE_VENDOR || {};
    let state = { enabled: !!pub, valid: false, payload: null, reason: '', trialDaysLeft: TRIAL_DAYS, locked: false };

    const b64urlToBytes = (s) => {
        const b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
        const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
        return Uint8Array.from(bin, c => c.charCodeAt(0));
    };

    const hostAllowed = (domains) => {
        if (!Array.isArray(domains) || !domains.length) return true;
        const h = location.hostname.toLowerCase();
        return domains.some(d => { d = String(d).toLowerCase().replace(/^\*\./, ''); return h === d || h.endsWith('.' + d); });
    };

    /** Returns { valid, payload, reason } */
    const verify = async (key) => {
        key = String(key || '').trim();
        if (!key) return { valid: false, reason: 'Chưa nhập mã bản quyền' };
        const parts = key.split('.');
        if (parts.length !== 2) return { valid: false, reason: 'Mã bản quyền không đúng định dạng' };
        if (!window.crypto || !crypto.subtle) return { valid: false, reason: 'Cần mở tool qua địa chỉ https để kiểm tra bản quyền' };
        let payload;
        try {
            const data = b64urlToBytes(parts[0]);
            const sig = b64urlToBytes(parts[1]);
            const k = await crypto.subtle.importKey('jwk', pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
            const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, sig, data);
            if (!ok) return { valid: false, reason: 'Mã bản quyền không hợp lệ' };
            payload = JSON.parse(new TextDecoder().decode(data));
        } catch (e) {
            return { valid: false, reason: 'Mã bản quyền không hợp lệ' };
        }
        if (payload.exp && new Date(payload.exp) < new Date()) return { valid: false, payload, reason: `Bản quyền đã hết hạn ngày ${new Date(payload.exp).toLocaleDateString('vi-VN')}` };
        if (!hostAllowed(payload.domains)) return { valid: false, payload, reason: `Bản quyền không dùng cho địa chỉ ${location.hostname}` };
        return { valid: true, payload, reason: '' };
    };

    const trialStart = () => {
        let t = safeStorage.get(STORAGE.trial, null);
        if (!t || isNaN(new Date(t))) { t = new Date().toISOString(); safeStorage.set(STORAGE.trial, t); }
        return new Date(t);
    };

    const refresh = async () => {
        if (!state.enabled) { render(); return state; }
        const cfg = getAgencyConfig();
        const r = await verify(cfg.licenseKey);
        const left = Math.ceil(TRIAL_DAYS - (Date.now() - trialStart()) / 86400000);
        state = { ...state, valid: r.valid, payload: r.payload || null, reason: r.reason, trialDaysLeft: Math.max(0, left) };
        state.locked = !r.valid && (!!cfg.licenseKey && r.payload ? true : left <= 0);
        if (r.valid && r.payload.agency && cfg.agencyName !== r.payload.agency) setAgencyConfig({ ...cfg, agencyName: r.payload.agency });
        render();
        return state;
    };

    const fmtDate = (d) => new Date(d).toLocaleDateString('vi-VN');
    const contact = () => [vendor.name, vendor.contact].filter(Boolean).join(' · ');

    const describe = () => {
        if (!state.enabled) return '';
        if (state.valid) {
            const p = state.payload;
            return `<span class="text-green-400"><i class="fas fa-circle-check mr-1"></i>Bản quyền: <b>${escapeHtml(p.agency)}</b>${p.plan ? ` (${escapeHtml(p.plan)})` : ''}${p.exp ? `, hết hạn ${fmtDate(p.exp)}` : ''}</span>`;
        }
        return `<span class="text-yellow-400"><i class="fas fa-key mr-1"></i>${state.trialDaysLeft > 0 && !state.locked ? `Bản dùng thử: còn ${state.trialDaysLeft} ngày.` : ''} ${escapeHtml(state.reason)}</span>`;
    };

    const render = () => {
        const banner = $('license-banner');
        const lock = $('license-lock');
        if (!banner || !lock) return;
        const cfgStatus = $('cfg-license-status');
        if (cfgStatus) cfgStatus.innerHTML = describe();
        if (!state.enabled) { banner.classList.add('hidden'); lock.classList.add('hidden'); lock.classList.remove('flex'); return; }
        let msg = '';
        if (state.valid && state.payload.exp) {
            const days = Math.ceil((new Date(state.payload.exp) - Date.now()) / 86400000);
            if (days <= 15) msg = `Bản quyền hết hạn sau ${days} ngày (${fmtDate(state.payload.exp)}). ${contact() ? 'Liên hệ ' + escapeHtml(contact()) + ' để gia hạn.' : ''}`;
        } else if (!state.valid && !state.locked) {
            msg = `Bản dùng thử: còn ${state.trialDaysLeft} ngày. <button class="underline" onclick="switchTab('config')">Nhập mã bản quyền</button>${contact() ? ' · Liên hệ: ' + escapeHtml(contact()) : ''}`;
        }
        banner.innerHTML = msg;
        banner.classList.toggle('hidden', !msg);
        lock.classList.toggle('hidden', !state.locked);
        lock.classList.toggle('flex', state.locked);
        if (state.locked) {
            $('license-lock-reason').textContent = state.reason && getAgencyConfig().licenseKey ? state.reason : 'Thời gian dùng thử đã kết thúc.';
            $('license-lock-contact').textContent = contact() ? `Liên hệ ${contact()} để mua hoặc gia hạn bản quyền.` : '';
        }
    };

    const activate = async (key) => {
        setAgencyConfig({ ...getAgencyConfig(), licenseKey: String(key || '').trim() });
        const s = await refresh();
        if (s.valid) showToast(`Đã kích hoạt bản quyền cho ${s.payload.agency}`);
        else showToast(s.reason || 'Mã bản quyền không hợp lệ', 'error');
        if (typeof renderConfigTab === 'function' && currentTabId === 'config') renderConfigTab();
        return s;
    };

    const status = () => ({ ...state });
    document.addEventListener('DOMContentLoaded', () => { refresh(); });
    return { refresh, status, describe, activate, verify, TRIAL_DAYS };
})();
