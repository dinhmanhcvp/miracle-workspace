'use strict';
/*
 * "Phân tích KOC" bookmarklet + analysis of grabbed KOC pages + TikTok search suggestions.
 * Depends on matcher.js (KocMatcher), app.js (helpers, AI) and koc.js (KOC database, brief).
 */

// Captured before app.js rewrites the hash on startup
const INITIAL_HASH = location.hash;

// =====================================================================
// 1) BOOKMARKLET SOURCE: runs on the KOC's page (tiktok.com / youtube.com).
//    Must be self-contained: it is serialized with toString() into the bookmark.
//    It only reads what is already loaded in the page the user is viewing
//    (plus the subtitle file of the video being watched). No crawling.
// =====================================================================
function grabKocPage(TOOL) {
    var MAXV = 40;
    var txt = function (sel, root) { var e = (root || document).querySelector(sel); return e ? String(e.innerText || e.textContent || '').trim() : ''; };
    var out = { v: 1, url: location.href.split('?')[0], grabbedAt: new Date().toISOString(), videos: [] };
    // Open the tab synchronously (inside the click) so popup blockers allow it; fill it in later.
    var win = window.open('about:blank', '_blank');
    try { if (win) win.document.write('<p style="font:16px sans-serif;padding:24px">Đang thu thập dữ liệu từ TikTok, vui lòng chờ vài giây...</p>'); } catch (e) { }
    var send = function () {
        if (out.type !== 'search' && !out.name && !out.handle) {
            out.name = prompt('Không đọc được tên KOC. Nhập tên:') || '';
            if (!out.name) { if (win) win.close(); return; }
        }
        var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(out)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        var target = TOOL.split('#')[0] + '#grab=' + b64;
        if (win) win.location.href = target; else location.href = target;
    };
    // Videos that sell: cart / product / Shop badge on the card
    var shopOn = function (el) { return !!(el && (el.querySelector('[data-e2e*="product"], [data-e2e*="shop"], [data-e2e*="anchor"], [class*="Product"], [class*="Shop"]') || /giỏ hàng|tiktok shop|cửa hàng|\bshop\b/i.test(el.innerText || ''))); };
    var host = location.hostname;
    var path = location.pathname;
    if (/(^|\.)tiktok\.com$/.test(host) && /^\/(search|tag|discover|explore|music)(\/|$)/.test(path)) {
        // ---- Search / hashtag page: collect every creator shown, after loading a few more results ----
        out.source = 'tiktok';
        out.type = 'search';
        var qs = new URLSearchParams(location.search);
        var tagM = path.match(/^\/tag\/([^/?#]+)/);
        out.query = qs.get('q') || (tagM ? '#' + decodeURIComponent(tagM[1]) : document.title);
        out.queryType = tagM ? 'tag' : (/^\/search\/user/.test(path) ? 'user' : 'video');
        var collect = function () {
            var by = {}, order = [], seenVid = {};
            var get = function (h) { h = decodeURIComponent(h); if (!by[h]) { by[h] = { handle: h, name: '', followersText: '', bio: '', videos: [] }; order.push(h); } return by[h]; };
            // account results
            var users = document.querySelectorAll('[data-e2e="search-user-container"], [data-e2e="search-user-item"], [data-e2e="search_user-item-list"] > div');
            for (var i = 0; i < users.length; i++) {
                var c = users[i], a = c.querySelector('a[href*="/@"]');
                var hm = a && a.getAttribute('href').match(/\/@([^/?#]+)/);
                if (!hm) continue;
                var u = get(hm[1]);
                u.name = u.name || txt('[data-e2e="search-user-title"]', c) || txt('[data-e2e="search-user-nickname"]', c) || txt('p', c);
                var fm = String(c.innerText || '').match(/([\d.,]+\s*[KMBkmb]?)\s*(Followers|Follower|Người theo dõi|follower)/);
                if (fm) u.followersText = fm[1];
                u.bio = u.bio || txt('[data-e2e="search-user-desc"]', c);
            }
            // video results (search, hashtag, music, explore): group by author
            var links = document.querySelectorAll('a[href*="/video/"], a[href*="/photo/"]');
            for (var j = 0; j < links.length; j++) {
                var href = links[j].href, vm = href.match(/\/@([^/?#]+)\/(?:video|photo)\/(\d+)/);
                if (!vm || seenVid[vm[2]]) continue;
                seenVid[vm[2]] = 1;
                var card = links[j].closest('[data-e2e*="item"], [class*="ItemContainer"], [class*="DivContainer"]') || links[j].parentElement;
                var cr = get(vm[1]);
                if (cr.videos.length >= 6) continue;
                var img = card.querySelector('img[alt]');
                var desc = txt('[data-e2e*="caption"]', card) || txt('[data-e2e*="desc"]', card) || (img ? img.alt : '');
                cr.videos.push({ url: href.split('?')[0], desc: String(desc).slice(0, 250), viewsText: txt('[data-e2e*="views"]', card) || txt('strong', card), shop: shopOn(card) });
                cr.name = cr.name || txt('[data-e2e*="user-name"]', card) || txt('[data-e2e*="nickname"]', card) || txt('[data-e2e*="unique-id"]', card);
            }
            out.creators = order.slice(0, 120).map(function (h) { return by[h]; });
        };
        // Load a few more results like a person scrolling (stops early when nothing new loads)
        var rounds = 0, lastH = 0;
        var step = function () {
            var h = document.documentElement.scrollHeight;
            var more = document.querySelector('[data-e2e="search-load-more"], button[class*="LoadMore"]');
            if (rounds >= 4 || (rounds > 0 && h === lastH && !more)) { collect(); window.scrollTo(0, 0); send(); return; }
            lastH = h; rounds++;
            if (more) more.click();
            window.scrollTo(0, h);
            setTimeout(step, 1200);
        };
        step();
        return;
    }
    if (/(^|\.)tiktok\.com$/.test(host)) {
        out.source = 'tiktok';
        var m = path.match(/^\/@([^/]+)(?:\/(?:video|photo)\/(\d+))?/);
        out.handle = m ? decodeURIComponent(m[1]) : '';
        out.type = m && m[2] ? 'video' : 'profile';
        var scope = {};
        try { scope = JSON.parse(document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__').textContent).__DEFAULT_SCOPE__ || {}; } catch (e) { }
        // TikTok is a single-page app: embedded data belongs to the FIRST page loaded,
        // so only trust it when it matches the current URL.
        var ui = scope['webapp.user-detail'] && scope['webapp.user-detail'].userInfo;
        if (ui && ui.user && ui.user.uniqueId === out.handle) {
            var st = ui.statsV2 || ui.stats || {};
            out.name = ui.user.nickname || '';
            out.bio = ui.user.signature || '';
            out.followers = +st.followerCount || 0;
            out.likes = +st.heartCount || +st.heart || 0;
            out.videoCount = +st.videoCount || 0;
        }
        var it = scope['webapp.video-detail'] && scope['webapp.video-detail'].itemInfo && scope['webapp.video-detail'].itemInfo.itemStruct;
        var subUrl = '';
        if (out.type === 'video') {
            // Some videos (often ones with a TikTok Shop cart) cannot be played on the web
            var unavailable = /video (hiện )?không khả dụng|không xem được trên web|xem trên ứng dụng|currently unavailable|isn.t available|video unavailable|get the (full )?app|mở ứng dụng/i.test(String(document.body.innerText || '').slice(0, 5000));
            if (it && String(it.id) === m[2]) {
                var vs = it.statsV2 || it.stats || {};
                var anchors = JSON.stringify(it.anchors || it.products || it.productInfo || '').slice(0, 2000);
                out.video = { id: it.id, desc: it.desc || '', views: +vs.playCount || 0, likes: +vs.diggCount || 0, comments: +vs.commentCount || 0, shares: +vs.shareCount || 0, shop: /product|shop|commerce|ecom/i.test(anchors), unavailable: unavailable };
                if (it.author) { out.name = out.name || it.author.nickname || ''; out.bio = out.bio || it.author.signature || ''; }
                var as = it.authorStatsV2 || it.authorStats;
                if (as) { out.followers = out.followers || +as.followerCount || 0; out.likes = out.likes || +as.heartCount || 0; out.videoCount = out.videoCount || +as.videoCount || 0; }
                var subs = (it.video && (it.video.subtitleInfos || it.video.subtitles)) || [];
                var pick = null;
                for (var i2 = 0; i2 < subs.length; i2++) {
                    var lang = String(subs[i2].LanguageCodeName || subs[i2].languageCodeName || subs[i2].LanguageID || '').toLowerCase();
                    if (!pick || /vi/.test(lang)) pick = subs[i2];
                    if (/vi/.test(lang)) break;
                }
                if (pick) subUrl = pick.Url || pick.url || '';
            } else {
                out.video = { desc: txt('[data-e2e="browse-video-desc"]') || txt('[data-e2e="video-desc"]'), likesText: txt('[data-e2e="browse-like-count"]') || txt('[data-e2e="like-count"]'), commentsText: txt('[data-e2e="browse-comment-count"]') || txt('[data-e2e="comment-count"]'), stale: !unavailable, unavailable: unavailable, shop: shopOn(document.querySelector('[data-e2e="browse-video-desc"]') ? document.querySelector('[data-e2e="browse-video-desc"]').parentElement : null) };
            }
        }
        out.name = out.name || txt('[data-e2e="user-subtitle"]') || txt('[data-e2e="browse-username"]') || txt('[data-e2e="user-title"]');
        out.bio = out.bio || txt('[data-e2e="user-bio"]');
        if (!out.followers) out.followersText = txt('[data-e2e="followers-count"]');
        if (!out.likes) out.likesText = txt('[data-e2e="likes-count"]');
        var items = document.querySelectorAll('[data-e2e="user-post-item"]');
        for (var j2 = 0; j2 < items.length && j2 < MAXV; j2++) {
            var el = items[j2];
            var a2 = el.querySelector('a[href*="/video/"], a[href*="/photo/"]');
            var img2 = el.querySelector('img[alt]');
            out.videos.push({ url: a2 ? a2.href : '', desc: img2 ? String(img2.alt).slice(0, 400) : '', viewsText: txt('[data-e2e="video-views"]', el), pinned: !!el.querySelector('[data-e2e="video-card-badge"]') && /ghim|pinned/i.test(el.innerText || ''), shop: shopOn(el) });
        }
        if (subUrl) {
            fetch(subUrl).then(function (r) { return r.text(); }).then(function (t) { out.video.transcriptRaw = t.slice(0, 40000); send(); })
                .catch(function () { out.video.transcriptError = true; send(); });
            return;
        }
    } else if (/youtube\.com$/.test(host)) {
        out.source = 'youtube';
        out.type = /\/watch/.test(path) ? 'video' : 'profile';
        out.name = txt('#channel-name #text') || txt('ytd-channel-name #text') || txt('yt-dynamic-text-view-model h1') || txt('h1');
        out.followersText = (txt('#owner-sub-count') || txt('#subscriber-count') || txt('yt-content-metadata-view-model')).replace(/subscribers?|người đăng ký/gi, '').split('•').filter(function (x) { return /\d/.test(x); })[0] || '';
        out.bio = txt('#description-container') || txt('#description');
        var tiles = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer');
        for (var k = 0; k < tiles.length && k < MAXV; k++) out.videos.push({ desc: txt('#video-title', tiles[k]), viewsText: (txt('#metadata-line span', tiles[k]) || '').replace(/views?|lượt xem/gi, '') });
    } else {
        out.source = 'web';
        out.type = 'profile';
        out.name = txt('h1') || document.title;
        out.bio = (document.querySelector('meta[name="description"]') || {}).content || '';
    }
    send();
}

/** Build the bookmarklet URL from the function above. */
const buildGrabBookmarklet = (toolUrl) => 'javascript:' + encodeURIComponent('(' + grabKocPage.toString() + ')(' + JSON.stringify(toolUrl) + ');void 0;');

// =====================================================================
// 2) TOOL SIDE: decode, analyze, show, save
// =====================================================================
let currentGrab = null; // { summary, draft (KOC), ai, existingId }

const decodeGrab = (hash) => {
    const m = String(hash || '').match(/^#grab=([A-Za-z0-9_-]+)$/);
    if (!m || m[1].length > 2_000_000) return null;
    try {
        const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(escape(atob(b64 + '==='.slice((b64.length + 3) % 4))));
        const p = JSON.parse(json);
        return p && typeof p === 'object' && p.v === 1 ? p : null;
    } catch (e) {
        return null;
    }
};

const findExistingKoc = (summary) => {
    const link = KM.norm(summary.link).replace(/\/+$/, '');
    return kocs.find(k => k.link && KM.norm(k.link).replace(/[?#].*$/, '').replace(/\/+$/, '') === link)
        || kocs.find(k => KM.norm(k.name) === KM.norm(summary.name) && k.platform === summary.platform);
};

/** Turn a rule-based summary (+ optional AI result) into a KOC record, keeping manual data of an existing record. */
const buildKocFromGrab = (summary, ai, existing) => {
    const base = existing || {};
    const prevAnalysis = base.analysis || {};
    const transcripts = Array.isArray(prevAnalysis.transcripts) ? prevAnalysis.transcripts.slice() : [];
    if (summary.transcript) {
        const entry = { url: summary.videoUrl, text: summary.transcript.slice(0, 4000) };
        const i = transcripts.findIndex(t => t.url === entry.url);
        if (i > -1) transcripts[i] = entry; else transcripts.unshift(entry);
    }
    const analysis = {
        analyzedAt: new Date().toISOString(),
        source: summary.platform,
        videosAnalyzed: summary.videosAnalyzed,
        hashtags: summary.hashtags,
        sponsoredRatio: Math.round(summary.sponsoredRatio * 100) / 100,
        shopRatio: Math.round(summary.shopRatio * 100) / 100,
        erSource: summary.isVideo || !(prevAnalysis.erSource === 'video đang xem' && base.er) ? summary.erSource : prevAnalysis.erSource,
        transcripts: transcripts.slice(0, 5),
        ai: ai || prevAnalysis.ai || null,
    };
    const aiCats = ai && Array.isArray(ai.categories) ? ai.categories : [];
    const notesParts = [];
    if (ai && ai.summary) notesParts.push(ai.summary);
    if (ai && ai.contentStyle) notesParts.push('Phong cách: ' + ai.contentStyle);
    const autoNotes = notesParts.join(' | ');
    return KM.normalizeKoc({
        ...base,
        name: base.name || summary.name,
        platform: summary.platform || base.platform,
        link: summary.link || base.link,
        followers: summary.followers || base.followers,
        // one video is not an average: keep the channel's average views when grabbing a single video
        avgViews: summary.isVideo && base.avgViews ? base.avgViews : (summary.avgViews || base.avgViews),
        // ER measured on a real video beats the channel-level estimate
        er: summary.isVideo ? (summary.er || base.er) : (prevAnalysis.erSource === 'video đang xem' && base.er ? base.er : (summary.er || base.er)),
        categories: aiCats.length ? aiCats : (summary.categories.length ? summary.categories : base.categories),
        gender: (ai && ['nu', 'nam', 'all'].includes(ai.gender) ? ai.gender : '') || base.gender,
        ages: (ai && ai.ages && ai.ages.length ? ai.ages : null) || base.ages,
        location: (ai && ai.location) || base.location || summary.locations[0] || '',
        notes: base.notes && !base.demo ? (autoNotes && !base.notes.includes(autoNotes) ? `${base.notes}\n${autoNotes}` : base.notes) : (autoNotes || summary.bio),
        tags: summary.hashtags.slice(0, 10).join(' '),
        shopRatio: summary.videosAnalyzed > 1 ? summary.shopRatio : base.shopRatio,
        analysis,
        demo: false,
    });
};

const SAFETY_STYLE = { 'an toàn': 'text-green-400', 'cần lưu ý': 'text-yellow-400', 'rủi ro': 'text-red-400' };

const renderGrabModal = () => {
    const { summary, ai, existingId } = currentGrab;
    const draft = buildKocFromGrab(summary, ai, kocs.find(k => k.id === existingId));
    currentGrab.draft = draft;
    const brief = readBriefForm();
    const hasBrief = brief.categories.length || brief.platforms.length || brief.totalBudget || brief.gender || brief.ages.length;
    const scored = KM.scoreKoc(draft, brief, matchCtx());
    const fmt = (n) => n ? KM.formatFollowers(n) : '—';
    const cats = (draft.categories || []).map(c => labelOf(KM.CATEGORIES, c)).join(', ') || 'chưa xác định';
    const warnings = [];
    if (summary.unavailable) warnings.push('Video này không xem được trên TikTok web (hay gặp với video gắn giỏ hàng / TikTok Shop), nên không lấy được phụ đề. Tool dùng caption và số liệu có sẵn; để đủ dữ liệu, mở trang profile của KOC rồi bấm bookmark.');
    if (summary.stale) warnings.push('TikTok chưa tải lại dữ liệu video này (bạn đã chuyển trang trong TikTok). Bấm F5 trên trang video rồi bấm bookmark lại để lấy phụ đề và số liệu chính xác.');
    if (summary.transcriptError) warnings.push('Không tải được phụ đề của video này.');
    if (summary.isVideo && !summary.transcript && !summary.stale && !summary.transcriptError && !summary.unavailable) warnings.push('Video này không có phụ đề, chỉ phân tích caption.');
    if (!summary.videosAnalyzed && !summary.isVideo) warnings.push('Không đọc được video nào trên trang. Hãy cuộn xuống để lưới video hiện ra rồi bấm bookmark lại.');
    if (findBlacklisted(draft.name, draft.link)) warnings.unshift('⛔ KOC này nằm trong BLACKLIST của agency.');

    $('grab-body').innerHTML = `
        <div class="flex flex-wrap gap-4 items-start justify-between">
            <div>
                <div class="text-xl font-bold text-white">${escapeHtml(draft.name)} ${summary.handle ? `<span class="text-sm text-gray-400 font-normal">@${escapeHtml(summary.handle)}</span>` : ''}</div>
                <div class="text-xs text-gray-400 mt-1">${escapeHtml(labelOf(KM.PLATFORMS, draft.platform) || '')}${existingId ? ' · <span class="text-blue-400">đã có trong Kho KOC, sẽ cập nhật</span>' : ' · KOC mới'}</div>
                ${summary.bio ? `<div class="text-sm text-gray-300 mt-2 max-w-xl">${escapeHtml(summary.bio.slice(0, 300))}</div>` : ''}
            </div>
            ${hasBrief ? `<div class="text-center"><div class="text-3xl font-bold text-white">${scored.excluded ? '—' : scored.score}</div><div class="text-xs text-gray-400">điểm theo brief${brief.brand ? ' ' + escapeHtml(brief.brand) : ''}</div></div>` : ''}
        </div>
        ${warnings.length ? `<div class="p-3 rounded-lg bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 text-sm space-y-1">${warnings.map(w => `<div>${escapeHtml(w)}</div>`).join('')}</div>` : ''}
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-dark-900 rounded-lg p-3"><div class="text-xs text-gray-500">Follower</div><div class="text-lg font-semibold text-white">${fmt(draft.followers)}</div></div>
            <div class="bg-dark-900 rounded-lg p-3"><div class="text-xs text-gray-500">View TB (trung vị)</div><div class="text-lg font-semibold text-white">${fmt(draft.avgViews)}</div></div>
            <div class="bg-dark-900 rounded-lg p-3"><div class="text-xs text-gray-500">ER ${summary.erSource ? `<span title="${escapeHtml(summary.erSource)}">(ước tính)</span>` : ''}</div><div class="text-lg font-semibold text-white">${draft.er ? draft.er + '%' : '—'}</div></div>
            <div class="bg-dark-900 rounded-lg p-3"><div class="text-xs text-gray-500">Video QC / bán hàng</div><div class="text-lg font-semibold text-white">${summary.videosAnalyzed ? `${Math.round(summary.sponsoredRatio * 100)}% / ${Math.round(summary.shopRatio * 100)}%` : '—'}</div></div>
        </div>
        <div class="text-sm space-y-1">
            <div><span class="text-gray-500">Ngành:</span> <span class="text-white">${escapeHtml(cats)}</span></div>
            <div><span class="text-gray-500">Đã đọc:</span> ${summary.videosAnalyzed} caption${summary.transcript ? `, phụ đề ${summary.transcript.split(' ').length} từ` : ''}</div>
            ${summary.hashtags.length ? `<div><span class="text-gray-500">Hashtag hay dùng:</span> ${summary.hashtags.slice(0, 10).map(h => '#' + escapeHtml(h)).join(' ')}</div>` : ''}
        </div>
        <div id="grab-ai" class="p-4 rounded-lg border border-gray-700 bg-dark-900/60 text-sm">${renderGrabAi()}</div>
        ${hasBrief && !scored.excluded ? `<div class="text-sm"><div class="text-gray-400 mb-1">Đánh giá theo tiêu chí brief:</div><ul class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5 text-xs">${scored.reasons.map(x => `<li class="${REASON_STYLE[x.type].split(' ')[0]}"><i class="fas ${REASON_STYLE[x.type].split(' ')[1]} w-4"></i>${escapeHtml(x.text)}</li>`).join('')}</ul></div>` : ''}
        ${hasBrief && scored.excluded ? `<div class="text-sm text-red-400"><i class="fas fa-ban mr-1"></i>Bị loại theo brief: ${escapeHtml(scored.excluded)}</div>` : ''}
        ${!hasBrief ? '<div class="text-xs text-gray-500">Chưa có brief: điền brief ở tab Brief & Gợi ý KOC để xem điểm phù hợp.</div>' : ''}
        <p class="text-xs text-gray-500">Giá nhập, contact và đánh giá nội bộ không lấy được từ TikTok: bổ sung sau trong Kho KOC.</p>`;
};

const renderGrabAi = () => {
    const { ai, aiState, aiError } = currentGrab;
    if (aiState === 'loading') return '<i class="fas fa-spinner fa-spin mr-2"></i>AI đang đọc caption và phụ đề để đánh giá...';
    if (aiState === 'nokey') return '<span class="text-gray-400"><i class="fas fa-circle-info mr-1"></i>Chưa có Gemini API Key: đang dùng phân tích theo từ khóa. Thêm key trong Cài đặt để AI nhận xét phong cách, độ an toàn thương hiệu và mức độ phù hợp.</span>';
    if (aiState === 'error') return `<span class="text-red-400">AI lỗi: ${escapeHtml(aiError || '')}</span> <button onclick="runGrabAi()" class="underline text-gray-300 ml-2">Thử lại</button>`;
    if (!ai) return '';
    return `<div class="flex flex-wrap justify-between gap-2 mb-2"><span class="font-semibold text-white"><i class="fas fa-robot text-brand-500 mr-1"></i>Nhận xét của AI</span>
            ${ai.fitScore !== undefined ? `<span class="text-white">Mức phù hợp brief: <b>${Math.round(ai.fitScore)}/100</b></span>` : ''}</div>
        ${ai.summary ? `<p class="text-gray-200">${escapeHtml(ai.summary)}</p>` : ''}
        <div class="mt-2 space-y-1 text-xs">
            ${ai.contentStyle ? `<div><span class="text-gray-500">Phong cách:</span> ${escapeHtml(ai.contentStyle)}</div>` : ''}
            ${ai.audienceGuess ? `<div><span class="text-gray-500">Khán giả (dự đoán):</span> ${escapeHtml(ai.audienceGuess)}</div>` : ''}
            ${ai.brandSafety ? `<div><span class="text-gray-500">An toàn thương hiệu:</span> <span class="${SAFETY_STYLE[ai.brandSafety] || 'text-gray-300'}">${escapeHtml(ai.brandSafety)}</span>${ai.brandSafetyNotes ? ' – ' + escapeHtml(ai.brandSafetyNotes) : ''}</div>` : ''}
            ${ai.competitorMentions && ai.competitorMentions.length ? `<div><span class="text-gray-500">Từng nhắc tới brand khác:</span> ${ai.competitorMentions.map(escapeHtml).join(', ')}</div>` : ''}
            ${ai.fitReasons && ai.fitReasons.length ? `<ul class="list-disc pl-5 text-gray-300">${ai.fitReasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
        </div>`;
};

const runGrabAi = async () => {
    if (!currentGrab) return;
    if (!getApiKey()) { currentGrab.aiState = 'nokey'; renderGrabModal(); return; }
    const s = currentGrab.summary;
    const brief = readBriefForm();
    const existing = kocs.find(k => k.id === currentGrab.existingId);
    const oldTranscripts = existing && existing.analysis && Array.isArray(existing.analysis.transcripts) ? existing.analysis.transcripts.filter(t => t.url !== s.videoUrl).map(t => t.text) : [];
    const transcripts = [s.transcript, ...oldTranscripts].filter(Boolean).join('\n---\n').slice(0, 9000);
    const prompt = `Bạn là chuyên viên đánh giá KOC của agency. Dựa trên dữ liệu kênh dưới đây, đánh giá KOC và mức độ phù hợp với brief. CHỈ trả về một object JSON hợp lệ, không markdown:
{
 "categories": mảng ngành chính, giá trị trong [${KM.CATEGORIES.map(c => `"${c.id}"`).join(',')}],
 "gender": "nu" | "nam" | "all" (khán giả chủ yếu, dự đoán từ nội dung),
 "ages": mảng trong ${JSON.stringify(KM.AGES)},
 "location": một giá trị trong ${JSON.stringify(KM.LOCATIONS.map(l => l.id))} hoặc "",
 "contentStyle": string ngắn (phong cách, định dạng video, giọng điệu),
 "audienceGuess": string ngắn,
 "brandSafety": "an toàn" | "cần lưu ý" | "rủi ro",
 "brandSafetyNotes": string ngắn (ngôn từ, chủ đề nhạy cảm, drama...),
 "competitorMentions": mảng tên brand/sản phẩm KOC đã quảng cáo hoặc nhắc tới,
 "fitScore": số 0-100 mức phù hợp với brief (nếu brief trống thì đánh giá chung về chất lượng kênh),
 "fitReasons": mảng tối đa 4 lý do ngắn (cả điểm cộng và điểm trừ),
 "summary": 1-2 câu nhận xét tổng quan bằng tiếng Việt
}
Chỉ dựa trên dữ liệu được cung cấp, không bịa số liệu.

BRIEF: ${JSON.stringify({ brand: brief.brand, product: brief.product, categories: brief.categories, gender: brief.gender, ages: brief.ages, locations: brief.locations, keywords: brief.keywords, deliverable: brief.deliverable })}

KÊNH: ${JSON.stringify({ name: s.name, platform: s.platform, followers: s.followers, avgViews: s.avgViews, er: s.er, bio: s.bio, hashtags: s.hashtags })}
CAPTION CÁC VIDEO GẦN ĐÂY:
${s.captions.slice(0, 40).map((c, i) => `${i + 1}. ${c.slice(0, 250)}`).join('\n') || '(không có)'}
PHỤ ĐỀ (LỜI NÓI TRONG VIDEO):
${transcripts || '(không có)'}`;
    currentGrab.aiState = 'loading';
    renderGrabModal();
    try {
        const text = await callGemini(prompt);
        const ai = JSON.parse((text.match(/\{[\s\S]*\}/) || ['{}'])[0]);
        ai.categories = (Array.isArray(ai.categories) ? ai.categories : []).filter(c => KM.CATEGORIES.some(x => x.id === c));
        ai.ages = KM.normalizeAges(ai.ages);
        if (!KM.LOCATIONS.some(l => l.id === ai.location)) ai.location = '';
        ai.fitScore = Math.max(0, Math.min(100, Number(ai.fitScore) || 0));
        ['competitorMentions', 'fitReasons'].forEach(f => { ai[f] = (Array.isArray(ai[f]) ? ai[f] : []).map(String).slice(0, 8); });
        currentGrab.ai = ai;
        currentGrab.aiState = 'done';
    } catch (err) {
        currentGrab.aiState = 'error';
        currentGrab.aiError = err.message === 'QUOTA_EXCEEDED' ? 'API Key đã hết hạn mức' : err.message;
    }
    if (currentGrab) renderGrabModal();
};

const handleGrabPayload = (payload) => {
    if (payload.type === 'search') return Hunt.addFromSearch(payload);
    const summary = KM.summarizeGrab(payload);
    if (!summary.name) return showToast('Không đọc được dữ liệu KOC từ trang', 'error');
    const existing = findExistingKoc(summary);
    currentGrab = { summary, ai: null, aiState: '', existingId: existing ? existing.id : null };
    renderGrabModal();
    openModal('grab');
    runGrabAi();
};

const saveGrabbedKoc = ({ addToShortlist = false, toPnl = false } = {}) => {
    if (!currentGrab) return;
    renderGrabModal(); // refresh draft with latest AI result
    const draft = currentGrab.draft;
    if (findBlacklisted(draft.name, draft.link) && !confirm(`"${draft.name}" nằm trong blacklist. Vẫn lưu?`)) return;
    if (currentGrab.existingId) {
        const i = kocs.findIndex(k => k.id === currentGrab.existingId);
        if (i > -1) kocs[i] = { ...draft, id: currentGrab.existingId };
        persistKocs();
    } else {
        upsertKocs([draft]);
    }
    const saved = kocs.find(k => k.id === (currentGrab.existingId || draft.id)) || findExistingKoc(currentGrab.summary);
    if (addToShortlist && saved && !shortlistIds.includes(saved.id)) { shortlistIds.push(saved.id); persistShortlist(); }
    renderKocTable();
    refreshBriefEmptyState();
    showToast(`Đã lưu "${draft.name}" vào Kho KOC`);
    Hunt.updateFromProfile(currentGrab.summary);
    Hunt.render();
    currentGrab = null;
    closeModal('grab');
    if (toPnl && saved) sendKocToPnl(saved.id);
    else if (addToShortlist) { switchTab('brief'); runMatch({ silent: true }); }
};

// =====================================================================
// INIT
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
    const payload = decodeGrab(INITIAL_HASH);
    if (INITIAL_HASH.startsWith('#grab=')) {
        try { history.replaceState(null, '', location.pathname + '#brief'); } catch (e) { }
        if (payload) handleGrabPayload(payload);
        else showToast('Dữ liệu từ bookmarklet bị lỗi hoặc quá lớn', 'error');
    }
});
