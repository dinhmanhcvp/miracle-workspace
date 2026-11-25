'use strict';
/*
 * "Săn KOC" on TikTok web (desktop): the tool decides what to search, the user opens each search page,
 * one click on the bookmarklet collects every creator on that page, and the tool scores them against the brief.
 * Prospects stay on this computer until they are added to Kho KOC (which is synced to the team).
 * Depends on matcher.js, app.js, koc.js (kocs, readBriefForm, matchCtx, upsertKocs...).
 */
window.Hunt = (() => {
    const KEY_PROSPECTS = 'miracle_prospects';
    const KEY_PLAN = 'miracle_hunt_plan';
    const TYPE_LABEL = { video: 'Video', tag: 'Hashtag', user: 'Tài khoản', ai: 'AI web' };
    const normQ = (q) => KM.norm(KM.removeDiacritics(String(q || '').replace(/^#/, ''))).replace(/\s+/g, ' ');

    let prospects = safeStorage.getJSON(KEY_PROSPECTS, []);
    if (!Array.isArray(prospects)) prospects = [];
    let plan = safeStorage.getJSON(KEY_PLAN, null) || { items: [], scanned: {} };
    const save = () => { safeStorage.set(KEY_PROSPECTS, JSON.stringify(prospects)); safeStorage.set(KEY_PLAN, JSON.stringify(plan)); };

    const kocHandles = () => new Set(kocs.map(k => KM.handleFromLink(k.link)).filter(Boolean));
    const inKho = (p, set = kocHandles()) => set.has('tiktok:' + String(p.handle).toLowerCase());

    const toKoc = (p) => KM.normalizeKoc({
        name: p.name || p.handle, platform: 'TikTok', link: p.link, followers: p.followers, avgViews: p.avgViews,
        categories: p.categories, location: (p.locations || [])[0] || '', shopRatio: typeof p.shopRatio === 'number' ? p.shopRatio : undefined,
        notes: [p.ai && p.ai.reason ? 'AI: ' + p.ai.reason : '', (p.queries || []).length ? `Tìm thấy qua: ${p.queries.join(', ')}` : ''].filter(Boolean).join(' | '),
        tags: (p.hashtags || []).join(' '),
        analysis: { source: p.source === 'ai-web' ? 'ai-web-search' : 'tiktok-search', captions: (p.captions || []).slice(0, 4), shopRatio: p.shopRatio, sponsoredRatio: p.sponsoredRatio },
    });

    const scoreProspect = (p, brief, ctx) => {
        const k = toKoc(p);
        // judge the channel on its own content only (the search query must not count as "related content")
        k.notes = `${p.bio || ''} ${(p.captions || []).join(' ')}`;
        const r = KM.scoreKoc(k, brief, ctx);
        const reasons = r.reasons.filter(x => !/giá nhập|CPV|Chưa có ER/.test(x.text)); // prospects have no price / ER yet
        const ai = p.ai && typeof p.ai.fit === 'number' ? p.ai.fit : null;
        return { ...r, reasons, final: r.excluded ? 0 : (ai === null ? r.score : Math.round((r.score + ai) / 2)) };
    };

    // ---------------- Search plan ----------------
    const makePlan = async (useAI = false) => {
        const brief = readBriefForm();
        let extra = { terms: [], hashtags: [] };
        if (useAI && getApiKey()) {
            const btn = $('btn-hunt-ai');
            const label = btn.innerHTML;
            btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang nghĩ...';
            try {
                const text = await callGemini(`Bạn là chuyên viên tìm KOC trên TikTok Việt Nam. Dựa trên brief, đề xuất cụm từ tìm kiếm và hashtag mà KOC phù hợp thật sự dùng trong video (từ người Việt hay gõ; hashtag viết liền không dấu). Ưu tiên nội dung review / trải nghiệm thật, đúng chân dung khán giả. CHỈ trả về JSON: {"terms": [tối đa 8], "hashtags": [tối đa 6, không có #]}.
BRIEF: ${JSON.stringify({ brand: brief.brand, product: brief.product, categories: brief.categories.map(c => labelOf(KM.CATEGORIES, c)), gender: brief.gender, ages: brief.ages, locations: brief.locations, goal: brief.goal, keywords: brief.keywords, raw: $('brief-raw').value.slice(0, 2000) })}`);
                const j = JSON.parse((text.match(/\{[\s\S]*\}/) || ['{}'])[0]);
                extra = { terms: (j.terms || []).map(String), hashtags: (j.hashtags || []).map(String) };
            } catch (err) {
                showToast(`AI lỗi (${err.message}). Dùng kế hoạch theo từ khóa.`, 'error');
            } finally { btn.disabled = false; btn.innerHTML = label; }
        } else if (useAI) {
            showToast('Chưa có Gemini API Key: dùng kế hoạch theo từ khóa.', 'info');
        }
        const items = KM.buildSearchPlan(brief, extra);
        if (!items.length) return showToast('Chưa đủ thông tin: chọn ít nhất 1 nhóm / ngành hoặc nhập sản phẩm, từ khóa trong brief.', 'error');
        plan = { items, scanned: plan.scanned || {}, createdAt: new Date().toISOString() };
        save();
        renderPlan();
        showToast(`Đã lập kế hoạch ${items.length} lượt tìm trên TikTok`);
    };

    const markScanned = (query, type, count) => {
        const q = normQ(query);
        let item = plan.items.find(it => normQ(it.q) === q && (!type || it.type === type)) || plan.items.find(it => normQ(it.q) === q);
        if (!item && q) {
            const t = type || 'video';
            item = { q: String(query).replace(/^#/, ''), type: t, key: `${t}:${q}`, url: KM.tiktokSearchUrl(String(query).replace(/^#/, ''), t), custom: true };
            plan.items.push(item);
        }
        if (item) plan.scanned[item.key] = { count, at: new Date().toISOString() };
    };

    const renderPlan = () => {
        const box = $('hunt-plan');
        if (!box) return;
        const items = plan.items || [];
        const done = items.filter(it => plan.scanned[it.key]).length;
        $('hunt-progress').textContent = items.length ? `Đã quét ${done}/${items.length} lượt tìm · ${prospects.length} ứng viên` : '';
        box.innerHTML = items.length ? items.map(it => {
            const sc = plan.scanned[it.key];
            return `<div class="flex flex-wrap items-center gap-2 py-1.5 border-b border-gray-800 last:border-0">
                <span class="text-[10px] uppercase px-1.5 py-0.5 rounded bg-dark-700 text-gray-400 w-20 text-center whitespace-nowrap">${TYPE_LABEL[it.type] || it.type}</span>
                <span class="flex-1 min-w-[8rem] text-sm ${sc ? 'text-gray-500' : 'text-gray-200'}">${it.type === 'tag' ? '#' : ''}${escapeHtml(it.q)}</span>
                ${sc ? `<span class="text-xs text-green-400"><i class="fas fa-check"></i> ${sc.count} KOC</span>` : ''}
                <a href="${escapeHtml(it.url)}" target="_blank" rel="noopener noreferrer" class="px-2 py-1 rounded text-xs ${sc ? 'bg-dark-700 text-gray-400' : 'bg-pink-700 text-white hover:bg-pink-600'}">${sc ? 'Mở lại' : 'Mở TikTok'} <i class="fas fa-arrow-up-right-from-square text-[10px]"></i></a>
            </div>`;
        }).join('') : '<p class="text-sm text-gray-500 italic">Bấm "Lập kế hoạch" để tool đề xuất cần tìm gì trên TikTok cho brief này.</p>';
    };

    // ---------------- Prospects ----------------
    /** Data from the bookmarklet on a TikTok search / hashtag page. */
    const addFromSearch = (payload) => {
        const r = KM.summarizeSearchGrab(payload);
        if (!r.candidates.length) {
            showToast('Không thấy KOC nào trên trang. Hãy đợi kết quả tìm kiếm hiện ra (cuộn xuống một chút) rồi bấm bookmark lại.', 'error');
            return;
        }
        let added = 0;
        const now = new Date().toISOString();
        r.candidates.forEach(c => {
            const ex = prospects.find(p => p.id === c.id);
            if (ex) {
                ex.followers = c.followers || ex.followers;
                ex.avgViews = c.avgViews || ex.avgViews;
                ex.categories = Array.from(new Set([...(ex.categories || []), ...c.categories]));
                ex.captions = Array.from(new Set([...(c.captions || []), ...(ex.captions || [])])).slice(0, 6);
                ex.hashtags = Array.from(new Set([...(ex.hashtags || []), ...c.hashtags])).slice(0, 10);
                ex.shopRatio = Math.max(ex.shopRatio || 0, c.shopRatio || 0);
                ex.queries = Array.from(new Set([...(ex.queries || []), r.query].filter(Boolean)));
                ex.verified = true;
                if (!ex.name || ex.name === ex.handle) ex.name = c.name;
            } else {
                prospects.push({ ...c, queries: r.query ? [r.query] : [], status: 'new', source: 'search', verified: true, seenAt: now });
                added++;
            }
        });
        markScanned(r.query, r.queryType, r.candidates.length);
        save();
        switchTab('brief');
        render();
        setTimeout(() => $('hunt-prospects-card').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        showToast(`Đã gom ${r.candidates.length} KOC từ "${r.query}" (${added} ứng viên mới)`);
    };

    /** After a deep analysis of one profile: refresh the matching prospect. */
    const updateFromProfile = (summary) => {
        if (!summary || !summary.handle) return;
        const p = prospects.find(x => x.id === 'tt:' + summary.handle.toLowerCase());
        if (!p) return;
        Object.assign(p, { followers: summary.followers || p.followers, avgViews: summary.avgViews || p.avgViews, verified: true, name: summary.name || p.name });
        if (summary.categories.length) p.categories = summary.categories;
        if (summary.videosAnalyzed) p.shopRatio = summary.shopRatio;
        save();
    };

    const renderProspects = () => {
        const box = $('hunt-prospects');
        if (!box) return;
        const filter = $('hunt-filter').value;
        const brief = readBriefForm();
        const ctx = matchCtx();
        const handles = kocHandles();
        prospects.forEach(p => { if (p.status !== 'skipped' && inKho(p, handles)) p.status = 'added'; });
        const rows = prospects
            .filter(p => filter === 'all' || (filter === 'new' ? p.status === 'new' : p.status === filter))
            .map(p => ({ p, s: scoreProspect(p, brief, ctx) }))
            .sort((a, b) => b.s.final - a.s.final);
        $('hunt-count').textContent = prospects.filter(p => p.status === 'new').length;
        $('hunt-prospects-card').classList.toggle('hidden', !prospects.length);
        box.innerHTML = rows.length ? rows.slice(0, 100).map(({ p, s }) => `
            <div class="p-3 rounded-lg border ${p.status === 'added' ? 'border-green-800 bg-green-900/10' : 'border-gray-800 bg-dark-900/50'} ${p.status === 'skipped' ? 'opacity-50' : ''}">
                <div class="flex flex-wrap gap-3 items-start">
                    <div class="w-12 text-center shrink-0">
                        <div class="text-xl font-bold text-white">${s.excluded ? '—' : s.final}</div>
                        <div class="h-1 rounded bg-dark-700 overflow-hidden"><div class="h-full ${scoreColor(s.final)}" style="width:${s.final}%"></div></div>
                        ${p.ai && typeof p.ai.fit === 'number' ? `<div class="text-[10px] text-brand-400 mt-1" title="Điểm theo tiêu chí ${s.score} · AI ${p.ai.fit}">AI ${p.ai.fit}</div>` : ''}
                    </div>
                    <div class="flex-1 min-w-[12rem]">
                        <div class="font-semibold text-white"><a href="${escapeHtml(p.link)}" target="_blank" rel="noopener noreferrer" class="hover:text-pink-400">${escapeHtml(p.name || p.handle)}</a>
                            <span class="text-xs text-gray-400 font-normal">@${escapeHtml(p.handle)}${p.followers ? ' · ' + KM.formatFollowers(p.followers) + ' follower' : ''}${p.avgViews ? ' · view TB ' + KM.formatFollowers(p.avgViews) : ''}</span>
                            ${p.verified ? '' : '<span class="text-[10px] px-1.5 rounded bg-yellow-900/50 text-yellow-300 ml-1" title="AI tìm trên web, chưa kiểm tra trên TikTok">chưa xác minh</span>'}
                            ${p.shopRatio >= 0.2 ? `<span class="text-[10px] px-1.5 rounded bg-orange-900/50 text-orange-300 ml-1">bán hàng ${Math.round(p.shopRatio * 100)}%</span>` : ''}</div>
                        <div class="text-xs text-gray-400 mt-0.5">${(p.categories || []).map(c => escapeHtml(labelOf(KM.CATEGORIES, c))).join(', ') || 'chưa rõ nhóm'}${(p.queries || []).length ? ' · từ: ' + p.queries.map(escapeHtml).join(', ') : ''}</div>
                        ${p.ai && p.ai.reason ? `<div class="text-xs text-brand-400 mt-1"><i class="fas fa-robot mr-1"></i>${escapeHtml(p.ai.reason)}</div>` : ''}
                        ${(p.captions || [])[0] ? `<div class="text-xs text-gray-500 mt-1 truncate" title="${escapeHtml(p.captions.join(' | '))}">“${escapeHtml(p.captions[0])}”</div>` : ''}
                        ${s.excluded ? `<div class="text-xs text-red-400 mt-1">Bị loại: ${escapeHtml(s.excluded)}</div>` : `<ul class="mt-1 flex flex-wrap gap-x-3 text-xs">${s.reasons.slice(0, 4).map(x => `<li class="${REASON_STYLE[x.type].split(' ')[0]}"><i class="fas ${REASON_STYLE[x.type].split(' ')[1]} mr-1"></i>${escapeHtml(x.text)}</li>`).join('')}</ul>`}
                    </div>
                    <div class="flex gap-1 flex-wrap justify-end shrink-0">
                        ${p.status === 'added' ? '<span class="px-2 py-1 rounded text-xs bg-green-800 text-white"><i class="fas fa-check"></i> Trong kho</span>'
                            : `<button onclick="Hunt.add('${escapeHtml(p.id)}')" class="px-2 py-1 rounded text-xs bg-brand-600 hover:bg-brand-500 text-white"><i class="fas fa-plus"></i> Kho KOC</button>
                               <button onclick="Hunt.add('${escapeHtml(p.id)}', true)" class="px-2 py-1 rounded text-xs bg-dark-700 hover:bg-dark-600 text-gray-200" title="Thêm vào kho và shortlist">+ Shortlist</button>
                               ${p.status === 'skipped' ? `<button onclick="Hunt.setStatus('${escapeHtml(p.id)}','new')" class="px-2 py-1 rounded text-xs bg-dark-700 text-gray-300">Khôi phục</button>` : `<button onclick="Hunt.setStatus('${escapeHtml(p.id)}','skipped')" class="px-2 py-1 rounded text-xs bg-dark-700 hover:bg-dark-600 text-gray-400">Bỏ qua</button>`}`}
                    </div>
                </div>
            </div>`).join('') + (rows.length > 100 ? `<p class="text-xs text-gray-500">Đang hiện 100/${rows.length} ứng viên điểm cao nhất.</p>` : '')
            : '<p class="text-sm text-gray-500 italic">Không có ứng viên nào trong bộ lọc này.</p>';
    };

    const add = (id, shortlist = false) => {
        const p = prospects.find(x => x.id === id);
        if (!p) return;
        if (findBlacklisted(p.name, p.link) && !confirm(`"${p.name}" nằm trong blacklist. Vẫn thêm?`)) return;
        upsertKocs([toKoc(p)]);
        p.status = 'added';
        save();
        const k = kocs.find(x => KM.handleFromLink(x.link) === 'tiktok:' + p.handle.toLowerCase());
        if (shortlist && k && !shortlistIds.includes(k.id)) { shortlistIds.push(k.id); persistShortlist(); }
        renderKocTable();
        refreshBriefEmptyState();
        if (lastRanking || shortlist) runMatch({ silent: true });
        render();
        showToast(`Đã thêm "${p.name || p.handle}" vào Kho KOC${shortlist ? ' và shortlist' : ''}. Mở kênh và bấm bookmark để phân tích sâu, bổ sung giá nhập.`);
    };

    const addAll = () => {
        const min = 60;
        const brief = readBriefForm(), ctx = matchCtx();
        const pick = prospects.filter(p => p.status === 'new').filter(p => scoreProspect(p, brief, ctx).final >= min);
        if (!pick.length) return showToast(`Không có ứng viên chưa xử lý nào từ ${min} điểm`, 'info');
        if (!confirm(`Thêm ${pick.length} ứng viên từ ${min} điểm vào Kho KOC?`)) return;
        upsertKocs(pick.map(toKoc));
        pick.forEach(p => { p.status = 'added'; });
        save();
        renderKocTable();
        refreshBriefEmptyState();
        render();
        showToast(`Đã thêm ${pick.length} KOC vào Kho KOC`);
    };

    const setStatus = (id, status) => { const p = prospects.find(x => x.id === id); if (p) { p.status = status; save(); render(); } };

    const clear = () => {
        if (!confirm('Xóa toàn bộ danh sách ứng viên và trạng thái kế hoạch tìm kiếm? (Kho KOC không bị ảnh hưởng)')) return;
        prospects = [];
        plan.scanned = {};
        save();
        render();
    };

    // ---------------- AI ----------------
    const parseJsonArray = (text) => {
        const m = String(text || '').match(/\[[\s\S]*\]/);
        if (!m) throw new Error('AI không trả về danh sách');
        return JSON.parse(m[0]);
    };

    /** One Gemini call scores up to 40 unprocessed prospects against the brief. */
    const aiScore = async () => {
        if (!getApiKey()) return showToast('Cần Gemini API Key (Cài đặt, hoặc key chung của team)', 'error');
        const brief = readBriefForm();
        const list = prospects.filter(p => p.status === 'new').slice(0, 40);
        if (!list.length) return showToast('Không có ứng viên chưa xử lý', 'info');
        const btn = $('btn-hunt-score');
        const label = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI đang chấm...';
        try {
            const text = await callGemini(`Bạn là chuyên viên chọn KOC của agency. Chấm mức phù hợp (0-100) của từng kênh TikTok với brief, dựa trên caption video và số liệu. Ưu tiên nội dung đúng ngành / đúng chân dung khán giả, review chân thật, view ổn định; trừ điểm kênh quá nhiều quảng cáo, nội dung nhạy cảm, lệch đối tượng.${brief.goal === 'sales' ? ' Brief cần bán hàng TikTok Shop: cộng điểm kênh có video gắn giỏ hàng / affiliate.' : ''}
CHỈ trả về mảng JSON: [{"handle": "...", "fit": số, "reason": "lý do ngắn tiếng Việt, tối đa 20 từ"}]
BRIEF: ${JSON.stringify({ brand: brief.brand, product: brief.product, categories: brief.categories.map(c => labelOf(KM.CATEGORIES, c)), gender: brief.gender, ages: brief.ages, locations: brief.locations, goal: brief.goal, keywords: brief.keywords })}
KÊNH: ${JSON.stringify(list.map(p => ({ handle: p.handle, name: p.name, followers: p.followers || null, avgViews: p.avgViews || null, shopRatio: p.shopRatio, hashtags: (p.hashtags || []).slice(0, 6), captions: (p.captions || []).slice(0, 3).map(c => c.slice(0, 140)) })))}`);
            const arr = parseJsonArray(text);
            let n = 0;
            arr.forEach(x => {
                const p = list.find(y => y.handle.toLowerCase() === String(x.handle || '').replace(/^@/, '').toLowerCase());
                if (p && isFinite(Number(x.fit))) { p.ai = { fit: Math.max(0, Math.min(100, Math.round(Number(x.fit)))), reason: String(x.reason || '').slice(0, 200) }; n++; }
            });
            save();
            render();
            showToast(`AI đã chấm ${n} ứng viên`);
        } catch (err) {
            showToast('AI lỗi: ' + (err.message === 'QUOTA_EXCEEDED' ? 'hết hạn mức API' : err.message), 'error');
        } finally { btn.disabled = false; btn.innerHTML = label; }
    };

    /** Gemini with Google Search grounding proposes real channels; they stay "unverified" until checked on TikTok. */
    const aiWebSearch = async () => {
        if (!getApiKey()) return showToast('Cần Gemini API Key (Cài đặt, hoặc key chung của team)', 'error');
        const brief = readBriefForm();
        if (!brief.categories.length && !brief.product && !brief.keywords.length) return showToast('Chọn nhóm / ngành hoặc nhập sản phẩm trong brief trước', 'error');
        const btn = $('btn-hunt-web');
        const label = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tìm trên web...';
        try {
            const text = await callGemini(`Dùng Google Search để tìm 10-15 TikToker / KOC Việt Nam ĐANG HOẠT ĐỘNG phù hợp brief dưới đây. Chỉ đưa kênh bạn thấy trong kết quả tìm kiếm, có tài khoản TikTok thật; KHÔNG đoán hay bịa tên. Ghi đúng username TikTok (phần sau @ trong tiktok.com/@username).
CHỈ trả về mảng JSON: [{"name": "...", "handle": "username", "followers": "ước lượng nếu nguồn có, ví dụ 120K, không có thì để trống", "reason": "vì sao phù hợp, tối đa 20 từ", "source": "URL nguồn"}]
BRIEF: ${JSON.stringify({ brand: brief.brand, product: brief.product, categories: brief.categories.map(c => labelOf(KM.CATEGORIES, c)), gender: brief.gender, ages: brief.ages, locations: brief.locations, goal: brief.goal, keywords: brief.keywords })}`, { tools: [{ google_search: {} }] });
            const arr = parseJsonArray(text);
            let added = 0;
            arr.forEach(x => {
                const raw = String(x.handle || '').trim().replace(/^https?:\/\/(www\.)?tiktok\.com\//, '').replace(/^@/, '');
                const handle = raw.split(/[/?#]/)[0];
                if (!/^[\w.]{2,30}$/.test(handle)) return; // reject anything that is not a clean TikTok username
                const id = 'tt:' + handle.toLowerCase();
                if (prospects.some(p => p.id === id)) return;
                prospects.push({
                    id, handle, name: String(x.name || handle).slice(0, 80), link: `https://www.tiktok.com/@${handle}`, platform: 'TikTok',
                    followers: Math.round(KM.parseNumber(String(x.followers || '').replace(/followers?|người theo dõi/gi, '')) || 0), avgViews: 0,
                    categories: brief.categories.slice(), captions: [], hashtags: [], queries: ['AI web'], status: 'new', source: 'ai-web', verified: false,
                    ai: { reason: String(x.reason || '').slice(0, 200) + (x.source ? ` (nguồn: ${String(x.source).slice(0, 120)})` : '') }, seenAt: new Date().toISOString(),
                });
                added++;
            });
            save();
            render();
            showToast(added ? `AI tìm thêm ${added} kênh trên web. Hãy mở kênh và bấm bookmark để xác minh trước khi dùng.` : 'AI không tìm được kênh mới phù hợp', added ? 'success' : 'info');
        } catch (err) {
            showToast('AI lỗi: ' + (err.message === 'QUOTA_EXCEEDED' ? 'hết hạn mức API' : err.message), 'error');
        } finally { btn.disabled = false; btn.innerHTML = label; }
    };

    const render = () => { renderPlan(); renderProspects(); };

    document.addEventListener('DOMContentLoaded', () => {
        const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        if ($('hunt-mobile-note')) $('hunt-mobile-note').classList.toggle('hidden', !mobile);
        render();
    });

    return { makePlan, addFromSearch, updateFromProfile, render, add, addAll, setStatus, clear, aiScore, aiWebSearch, _prospects: () => prospects, _plan: () => plan };
})();
