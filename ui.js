/* ============================================================
   SEO RANKER — ui.js
   UI infrastructure (modals, toasts, tooltips, animation) and the
   dashboard views. Rendering only: game rules live in the engine.
   ============================================================ */
(function () {
  'use strict';
  const SR = window.SR;
  const { fmt, money, esc, clamp } = SR;
  const S = SR.scoring, R = SR.ranking, A = SR.actions, E = SR.engine, M = SR.missions, AC = SR.achievements;

  const U = (SR.ui = { gs: null, view: 'overview', chartMetric: 'traffic', kwTab: 'all' });
  const $ = (sel, el) => (el || document).querySelector(sel);
  U.$ = $;

  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Small template helpers ---------- */
  U.icon = (name, cls) => `<i class="fa-solid ${name}${cls ? ' ' + cls : ''}" aria-hidden="true"></i>`;
  U.tip = key => {
    const g = SR.GLOSSARY[key];
    return g ? `<button type="button" class="info" data-tip="${key}" aria-label="What is ${esc(g[0])}?">?</button>` : '';
  };
  U.chip = (text, tone, icon) => `<span class="chip ${tone || 'neutral'}">${icon ? U.icon(icon) : ''}${text}</span>`;
  U.toneOf = t => ({ good: 'good', success: 'good', bad: 'bad', danger: 'bad', warn: 'warn', warning: 'warn' }[t] || 'neutral');

  /* Count-up numbers and animated bars remember what was shown last */
  const shownNum = {}, shownBar = {};
  U.num = (key, value, money_) => {
    const from = shownNum[key] !== undefined ? shownNum[key] : value;
    return `<span class="num" data-key="${key}" data-from="${from}" data-to="${value}" data-money="${money_ ? 1 : 0}">${money_ ? money(from) : fmt(from)}</span>`;
  };
  U.bar = (key, value, tone, extra) => {
    const v = clamp(Math.round(value), 0, 100);
    const from = shownBar[key] !== undefined ? shownBar[key] : v;
    return `<div class="bar ${extra || ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}"><div class="bar-fill ${tone || ''}" data-bk="${key}" data-w="${v}" style="width:${from}%"></div></div>`;
  };

  U.runAnimations = function (root) {
    const instant = reduceMotion();
    root.querySelectorAll('.num').forEach(el => {
      const from = +el.dataset.from, to = +el.dataset.to, isMoney = el.dataset.money === '1';
      shownNum[el.dataset.key] = to;
      const show = v => { el.textContent = isMoney ? money(v) : fmt(v); };
      if (instant || from === to) { show(to); return; }
      const t0 = performance.now(), dur = 650;
      const tick = now => {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        show(from + (to - from) * e);
        if (p < 1) requestAnimationFrame(tick); else show(to);
      };
      requestAnimationFrame(tick);
    });
    root.querySelectorAll('.bar-fill').forEach(el => {
      const to = +el.dataset.w;
      shownBar[el.dataset.bk] = to;
      void el.offsetWidth;
      el.style.width = to + '%';
    });
  };

  /* ============================================================
     Modals (accessible: focus trap, Esc, focus restore)
     ============================================================ */
  const stack = [];
  U.modalOpen = id => stack.some(m => m.id === id);
  U.topModal = () => stack[stack.length - 1] || null;

  U.openModal = function (opts) {
    const { id, title, body, footer, size = 'md', dismissible = true, flow = false, eyebrow, onClose } = opts;
    if (U.modalOpen(id)) U.closeModal(id, true);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.dataset.modal = id;
    overlay.innerHTML = `
      <div class="modal modal-${size}" role="dialog" aria-modal="true" aria-labelledby="${id}-title" tabindex="-1">
        <div class="modal-head">
          <div>${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h2 id="${id}-title">${title}</h2></div>
          ${dismissible ? '<button type="button" class="icon-btn" data-act="closeModal" aria-label="Close dialog">&times;</button>' : ''}
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>`;
    $('#modal-root').appendChild(overlay);
    stack.push({ id, el: overlay, dismissible, flow, onClose, opener: document.activeElement });
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => overlay.classList.add('show'));
    U.runAnimations(overlay);
    const target = overlay.querySelector('[data-autofocus]') || overlay.querySelector('.modal-foot .btn-primary') || overlay.querySelector('.modal');
    setTimeout(() => target && target.focus({ preventScroll: true }), 30);
    return overlay;
  };

  U.setModal = function (id, body, footer) {
    const m = stack.find(x => x.id === id);
    if (!m) return;
    m.el.querySelector('.modal-body').innerHTML = body;
    const f = m.el.querySelector('.modal-foot');
    if (f && footer !== undefined) f.innerHTML = footer;
    U.runAnimations(m.el);
  };

  U.closeModal = function (id, immediate) {
    const idx = id ? stack.findIndex(m => m.id === id) : stack.length - 1;
    if (idx < 0) return;
    const m = stack.splice(idx, 1)[0];
    const done = () => m.el.remove();
    if (immediate || reduceMotion()) done(); else { m.el.classList.remove('show'); setTimeout(done, 190); }
    if (!stack.length) document.body.classList.remove('modal-open');
    if (m.onClose) m.onClose();
    if (m.opener && document.contains(m.opener) && !stack.length) setTimeout(() => m.opener.focus({ preventScroll: true }), 0);
  };

  U.closeFlowModals = function () {
    stack.filter(m => m.flow).forEach(m => U.closeModal(m.id, true));
  };

  U.trapFocus = function (e) {
    const top = U.topModal();
    if (!top) return;
    const nodes = [...top.el.querySelectorAll('a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])')].filter(n => n.offsetParent !== null);
    if (!nodes.length) { e.preventDefault(); return; }
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (!top.el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  /* ============================================================
     Toasts and tooltips
     ============================================================ */
  U.toast = function (tone, title, text) {
    const root = $('#toast-root');
    if (!root) return;
    const icons = { success: 'fa-circle-check', danger: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    const t = document.createElement('div');
    t.className = `toast t-${tone}`;
    t.innerHTML = `${U.icon(icons[tone] || icons.info, 'toast-ic')}<div><strong>${title}</strong>${text ? `<span>${text}</span>` : ''}</div>`;
    root.appendChild(t);
    while (root.children.length > 4) root.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, 4600);
  };

  let tipOwner = null;
  U.showTip = function (btn) {
    const g = SR.GLOSSARY[btn.dataset.tip];
    const tip = $('#tooltip');
    if (!g || !tip) return;
    tip.innerHTML = `<strong>${esc(g[0])}</strong><span>${esc(g[1])}</span>`;
    tip.hidden = false;
    tipOwner = btn;
    const r = btn.getBoundingClientRect(), tw = Math.min(280, window.innerWidth - 24);
    tip.style.width = tw + 'px';
    let left = r.left + r.width / 2 - tw / 2;
    left = clamp(left, 12, window.innerWidth - tw - 12);
    tip.style.left = left + 'px';
    const h = tip.offsetHeight;
    const top = r.top - h - 10 >= 8 ? r.top - h - 10 : r.bottom + 10;
    tip.style.top = top + 'px';
    btn.setAttribute('aria-describedby', 'tooltip');
  };
  U.hideTip = function () {
    const tip = $('#tooltip');
    if (tip) tip.hidden = true;
    if (tipOwner) { tipOwner.removeAttribute('aria-describedby'); tipOwner = null; }
  };
  U.tipOwner = () => tipOwner;

  /* ============================================================
     Shell: top bar, navigation
     ============================================================ */
  const NAV = [
    { id: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
    { id: 'actions', label: 'Actions', icon: 'fa-bolt' },
    { id: 'keywords', label: 'Keywords', icon: 'fa-key' },
    { id: 'competitors', label: 'Competitors', icon: 'fa-chess-knight' },
    { id: 'growth', label: 'Growth', icon: 'fa-chart-line' },
    { id: 'progress', label: 'Progress', icon: 'fa-trophy' }
  ];

  function renderTopbar(gs) {
    const total = SR.CONFIG.TOTAL_MONTHS;
    const ended = gs.phase === 'ended';
    const canEnd = !ended && gs.flow.stage === 'play';
    const ticks = Array.from({ length: total }, (_, i) => `<i class="${i + 1 < gs.month || (ended && i + 1 <= gs.month) ? 'done' : i + 1 === gs.month ? 'now' : ''}"></i>`).join('');
    const dots = Array.from({ length: SR.CONFIG.MAX_AP }, (_, i) => `<i class="${i < gs.actionPoints ? 'on' : ''}"></i>`).join('');
    $('#topbar').innerHTML = `
      <div class="tb-inner">
        <div class="tb-brand"><span class="logo-mark" aria-hidden="true"><i class="fa-solid fa-magnifying-glass-chart"></i></span><span class="tb-name">SEO <strong>RANKER</strong></span></div>
        <div class="tb-stat tb-month" aria-label="Month ${gs.month} of ${total}">
          <span class="tb-label">Month</span><span class="tb-value">${gs.month} / ${total}</span><span class="ticks" aria-hidden="true">${ticks}</span>
        </div>
        <div class="tb-stat"><span class="tb-label">Budget ${U.tip('budget')}</span><span class="tb-value">${U.num('tb-budget', gs.budget, true)}</span></div>
        <div class="tb-stat" aria-label="${gs.actionPoints} of ${SR.CONFIG.MAX_AP} action points left">
          <span class="tb-label">Action Points ${U.tip('ap')}</span><span class="tb-value"><span class="ap-dots" aria-hidden="true">${dots}</span>${gs.actionPoints} / ${SR.CONFIG.MAX_AP}</span>
        </div>
        <div class="tb-actions">
          ${ended
            ? '<button class="btn btn-primary" data-act="showFinal"><i class="fa-solid fa-flag-checkered" aria-hidden="true"></i><span>Final Report</span></button>'
            : `<button class="btn btn-primary" data-act="endMonth" ${canEnd ? '' : 'disabled'}><i class="fa-solid fa-forward-step" aria-hidden="true"></i><span>${gs.month >= total ? 'Finish Month 12' : 'End Month ' + gs.month}</span></button>`}
          <button class="icon-btn" data-act="howTo" aria-label="How to play" title="How to play"><i class="fa-solid fa-circle-question" aria-hidden="true"></i></button>
          <button class="icon-btn" data-act="saveGame" aria-label="Save game" title="Save game"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i></button>
          <button class="icon-btn" data-act="menu" aria-label="Open menu" title="Menu"><i class="fa-solid fa-bars" aria-hidden="true"></i></button>
        </div>
      </div>`;
    U.runAnimations($('#topbar'));
  }

  function renderNav(gs) {
    const prof = SR.profile.load();
    const lvl = SR.profile.level(prof.xp);
    const items = NAV.map(n => `<button class="nav-item${U.view === n.id ? ' active' : ''}" data-act="nav" data-view="${n.id}" ${U.view === n.id ? 'aria-current="page"' : ''}>${U.icon(n.icon)}<span>${n.label}</span></button>`).join('');
    $('#sidenav').innerHTML = `
      <div class="nav-site"><span class="nav-site-ic">${U.icon(SR.WEBSITE_TYPES[gs.websiteType].icon)}</span><div><strong>${esc(gs.websiteName)}</strong><span>${SR.DIFFICULTIES[gs.difficulty].name} mode</span></div></div>
      <div class="nav-list">${items}</div>
      <div class="nav-rep">
        <div class="nr-row"><span>SEO Reputation ${U.tip('reputation')}</span><strong>${gs.reputation}</strong></div>
        ${U.bar('rep-side', gs.reputation, 'plum')}
        <p class="nr-lvl">Level ${lvl.level} · ${lvl.title}</p>
      </div>`;
    $('#bottomnav').innerHTML = NAV.map(n => `<button class="bn-item${U.view === n.id ? ' active' : ''}" data-act="nav" data-view="${n.id}" ${U.view === n.id ? 'aria-current="page"' : ''}>${U.icon(n.icon)}<span>${n.label}</span></button>`).join('');
    U.runAnimations($('#sidenav'));
  }

  U.renderAll = function () {
    const gs = U.gs;
    if (!gs) return;
    renderTopbar(gs);
    renderNav(gs);
    const v = $('#view');
    v.innerHTML = (VIEWS[U.view] || VIEWS.overview)(gs);
    U.runAnimations(v);
    U.drawCharts();
  };

  U.setView = function (view, focus) {
    U.view = view;
    U.renderAll();
    window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
    if (focus) { const m = $('#main'); m && m.focus({ preventScroll: true }); }
  };

  /* ============================================================
     Shared view components
     ============================================================ */
  const CATS = { tech: 'Technical', content: 'Content', authority: 'Authority', ux: 'Experience', ai: 'AI search', insight: 'Insight' };

  function card(title, body, opts = {}) {
    return `<section class="card ${opts.cls || ''}" ${opts.id ? `id="${opts.id}"` : ''}>
      ${title ? `<header class="card-h"><h3>${title}</h3>${opts.right || ''}</header>` : ''}${body}</section>`;
  }

  const KPIS = [
    { key: 'traffic', label: 'Organic Traffic', icon: 'fa-users', tip: 'traffic', snap: 'traffic', get: g => g.organicTraffic, pct: true, sub: 'Monthly search visitors' },
    { key: 'keywords', label: 'Ranking Keywords', icon: 'fa-key', tip: 'keywords', snap: 'keywords', get: g => g.rankingKeywords, pct: true, sub: 'Queries you appear for', live: true },
    { key: 'top10', label: 'Top 10 Keywords', icon: 'fa-ranking-star', tip: 'top10', snap: 'top10', get: g => g.top10Keywords, sub: 'Keywords on page one' },
    { key: 'seoScore', label: 'SEO Score', icon: 'fa-gauge-high', tip: 'seoScore', snap: 'seoScore', get: g => g.seoScore, bar: 'pink', sub: 'Overall site strength', live: true },
    { key: 'health', label: 'SEO Health', icon: 'fa-heart-pulse', tip: 'seoHealth', snap: 'health', get: g => g.seoHealth, bar: 'green', sub: 'Foundation quality', live: true },
    { key: 'authority', label: 'Authority', icon: 'fa-shield-halved', tip: 'authority', snap: 'authority', get: g => g.authority, bar: 'amber', sub: 'Trust from other sites', live: true },
    { key: 'aiVis', label: 'AI Visibility', icon: 'fa-brain', tip: 'aiVisibility', snap: 'aiVis', get: g => g.aiVisibility, bar: 'plum', sub: 'Simulated metric', live: true },
    { key: 'revenue', label: 'Revenue', icon: 'fa-indian-rupee-sign', tip: 'revenue', snap: 'revenue', get: g => g.monthlyRevenue, pct: true, money: true, sub: 'Per month from organic' }
  ];

  function kpiCard(k, gs, series) {
    const n = series.length, cur = series[n - 1], prev = series[n - 2];
    const val = k.get(gs);
    let trend = '<span class="trend flat">Starting point</span>';
    if (prev) {
      const d = cur[k.snap] - prev[k.snap];
      const dir = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
      const amount = k.pct ? `${Math.abs(SR.pct(cur[k.snap], prev[k.snap])).toFixed(1)}%` : String(Math.abs(Math.round(d)));
      trend = `<span class="trend ${dir}">${d > 0 ? '↑' : d < 0 ? '↓' : '→'} ${amount}</span><span class="trend-note">vs previous month</span>`;
    }
    const live = k.live ? Math.round(val - cur[k.snap]) : 0;
    const liveChip = live ? `<span class="live-chip ${live > 0 ? 'good' : 'bad'}">${live > 0 ? '+' : '−'}${Math.abs(live)} this month</span>` : '';
    const visual = k.bar ? U.bar('kpi-' + k.key, val, k.bar) : `<div class="spark-wrap">${SR.charts.sparkline(series.map(s => s[k.snap]))}</div>`;
    return `<article class="kpi">
      <div class="kpi-top"><span class="kpi-ic">${U.icon(k.icon)}</span><span class="kpi-label">${k.label} ${U.tip(k.tip)}</span></div>
      <div class="kpi-val">${U.num('kpi-' + k.key, val, k.money)}${k.bar ? '<small>/ 100</small>' : ''}</div>
      <div class="kpi-trend">${trend}</div>
      ${liveChip}
      <p class="kpi-sub">${k.sub}</p>
      ${visual}
    </article>`;
  }

  function componentBars(gs, keyPrefix) {
    return SR.COMPONENTS.map(c => {
      const v = Math.round(c.key === 'authNorm' ? S.authNorm(gs) : gs[c.key]);
      const tone = v >= 60 ? 'green' : v >= 40 ? 'amber' : 'red';
      return `<div class="cbar"><div class="cbar-h"><span>${c.label} ${U.tip(c.id === 'authority' ? 'authority' : c.id)} <em>${Math.round(c.weight * 100)}%</em></span><strong>${v}</strong></div>${U.bar(keyPrefix + c.id, v, tone)}</div>`;
    }).join('');
  }

  function scoreCard(gs) {
    const lvl = S.scoreLevel(gs.seoScore);
    return card('SEO Score ' + U.tip('seoScore'), `
      <div class="score-top">
        <div class="ring-wrap">${SR.charts.ring(gs.seoScore)}<div class="ring-center"><strong>${U.num('score-main', gs.seoScore)}</strong><span>/ 100</span></div></div>
        <div class="score-meta">${U.chip(lvl.label, U.toneOf(lvl.tone))}<p>Blends five weighted areas. Strengthen the weakest links first.</p></div>
      </div>
      <div class="cbars">${componentBars(gs, 'sc-')}</div>
      <button class="btn btn-secondary btn-block" data-act="scoreBreakdown">${U.icon('fa-list-check')} VIEW SCORE BREAKDOWN</button>`, { cls: 'score-card' });
  }

  function aiCard(gs) {
    const f = S.aiFactors(gs);
    const rows = [['entity', 'Entity Coverage'], ['clarity', 'Answer Clarity'], ['topical', 'Topical Authority'], ['structured', 'Structured Content'], ['source', 'Source Quality']]
      .map(([k, l]) => `<div class="cbar"><div class="cbar-h"><span>${l} ${U.tip(k)}</span><strong>${f[k]}</strong></div>${U.bar('ai-' + k, f[k], 'plum')}</div>`).join('');
    return card('Simulated AI Visibility ' + U.tip('aiVisibility'), `
      <div class="ai-top"><strong class="big">${U.num('ai-main', gs.aiVisibility)}</strong><span>/ 100</span>${U.chip('Simulated', 'neutral', 'fa-flask')}</div>
      <div class="cbars">${rows}</div>
      <p class="fine">A fictional game metric. It does not measure or predict any real AI search ranking.</p>`);
  }

  function focusCard(gs) {
    const focus = E.focus(gs);
    const chips = focus.map(f => `<li class="focus-item cat-${f.cat}"><strong>${f.area}</strong><span>${esc(f.reason)}</span></li>`).join('');
    return card(`Month ${gs.month}: Current Situation`, `
      <p class="situation">${esc(E.situation(gs))}</p>
      <div class="signals">${E.signals(gs).map(s => U.chip(esc(s.text), s.tone)).join('')}</div>
      <h4 class="sub-h">Recommended focus</h4>
      <ul class="focus-list">${chips || '<li class="focus-item"><span>Your fundamentals look balanced. Expand keywords and authority.</span></li>'}</ul>
      <p class="fine">Suggestions only. You decide the strategy.</p>`, { cls: 'focus-card' });
  }

  function monthActionsCard(gs) {
    const list = gs.actionsThisMonth;
    const rows = list.length ? list.map(a => `
      <li class="mact ${a.tone === 'danger' ? 'bad' : a.tone === 'warning' ? 'warn' : ''}">
        <span class="mact-ic">${a.tone === 'danger' ? U.icon('fa-triangle-exclamation') : U.icon('fa-check')}</span>
        <div><strong>${esc(a.name)}</strong><p>${esc(a.summary)}</p><span class="mact-meta">${money(a.cost)} · ${a.ap} AP</span></div>
      </li>`).join('') : '<li class="empty">No actions yet this month. Pick your moves in Actions.</li>';
    const spent = gs.budgetUsedThisMonth, used = list.reduce((a, x) => a + x.ap, 0);
    return card("This Month's Actions", `
      <div class="mini-stats"><div><span>Spent</span><strong>${money(spent)}</strong></div><div><span>AP used</span><strong>${used} / ${SR.CONFIG.MAX_AP}</strong></div><div><span>Budget left</span><strong>${money(gs.budget)}</strong></div></div>
      <ul class="mact-list">${rows}</ul>
      ${gs.phase === 'playing' && gs.actionPoints > 0 ? `<button class="btn btn-primary btn-block" data-act="nav" data-view="actions">${U.icon('fa-bolt')} Choose actions</button>` : ''}`);
  }

  function missionsCard(gs) {
    const rows = gs.missions.map(m => {
      const p = M.progress(gs, m);
      return `<li class="mission ${p.done ? 'done' : ''}">
        <div class="mission-h"><strong>${p.done ? U.icon('fa-circle-check') : U.icon('fa-bullseye')} ${esc(m.title)}</strong><span class="reward">+${money(m.reward.budget)} · +${m.reward.rep} rep</span></div>
        ${U.bar('mis-' + m.id, p.pct, p.done ? 'green' : 'pink')}
        <span class="fine">${p.done ? 'Completed' : esc(m.desc)}</span></li>`;
    }).join('');
    return card('Optional Missions', `<ul class="mission-list">${rows}</ul><p class="fine">Missions give bonus budget and reputation. They are never required to win.</p>`);
  }

  function competitorSnapshot(gs) {
    const p = gs.pressure;
    const news = gs.competitorNews.length ? gs.competitorNews.map(n => `<li>${U.icon('fa-chess-knight')} ${esc(n.text)}</li>`).join('') : '<li>Rivals are quiet for now.</li>';
    return card('Competitor Pressure ' + U.tip('pressure'), `
      <div class="press-top">${U.chip(S.pressureLabel(p), S.pressureTone(p))}<span class="fine">${p > 0 ? `Rivals lead by about ${p} pts` : `You lead by about ${Math.abs(p)} pts`}</span></div>
      <ul class="news-list">${news}</ul>
      <button class="btn btn-ghost btn-sm" data-act="nav" data-view="competitors">View competitors ${U.icon('fa-arrow-right')}</button>`);
  }

  function activityCard(gs) {
    const rows = gs.eventLog.slice(0, 7).map(l => `<li class="log ${U.toneOf(l.tone)}"><span class="log-ic">${U.icon(l.icon || 'fa-circle')}</span><div><strong>${esc(l.title)}</strong><p>${esc(l.text)}</p><span class="fine">Month ${l.month}</span></div></li>`).join('');
    return card('Activity Log', `<ul class="log-list" aria-live="polite">${rows || '<li class="empty">Your actions and events will appear here.</li>'}</ul>`);
  }

  /* ============================================================
     Views
     ============================================================ */
  const VIEWS = {};

  VIEWS.overview = gs => {
    const series = R.series(gs);
    const ended = gs.phase === 'ended';
    const banner = ended
      ? `<div class="banner done">${U.icon('fa-flag-checkered')}<div><strong>Campaign complete.</strong> Your 12 months are over. Review your final report any time.</div><button class="btn btn-primary btn-sm" data-act="showFinal">Final Report</button></div>`
      : gs.actionPoints > 0
        ? `<div class="banner">${U.icon('fa-bolt')}<div><strong>${gs.actionPoints} action point${gs.actionPoints > 1 ? 's' : ''} left this month.</strong> Spend them wisely, then end the month to see results.</div><button class="btn btn-primary btn-sm" data-act="nav" data-view="actions">Choose actions</button></div>`
        : `<div class="banner ready">${U.icon('fa-circle-check')}<div><strong>All action points used.</strong> End the month when you are ready.</div><button class="btn btn-primary btn-sm" data-act="endMonth">End Month ${gs.month}</button></div>`;
    return `
      <div class="view-head"><div><p class="eyebrow">${esc(gs.websiteName)}</p><h1>Overview</h1></div></div>
      ${banner}
      <div class="kpis">${KPIS.map(k => kpiCard(k, gs, series)).join('')}</div>
      <div class="grid">
        <div class="span-8">${card('Growth Trend', trendBody(), { right: '' })}</div>
        <div class="span-4">${scoreCard(gs)}</div>
        <div class="span-6">${focusCard(gs)}</div>
        <div class="span-6">${aiCard(gs)}</div>
        <div class="span-4">${monthActionsCard(gs)}</div>
        <div class="span-4">${missionsCard(gs)}</div>
        <div class="span-4">${competitorSnapshot(gs)}</div>
        <div class="span-12">${activityCard(gs)}</div>
      </div>
      <p class="fine foot-note">${SR.CONFIG.DISCLAIMER}</p>`;
  };

  function trendBody() {
    const tabs = Object.entries(SR.charts.METRICS).map(([id, m]) =>
      `<button role="tab" class="tab${U.chartMetric === id ? ' active' : ''}" aria-selected="${U.chartMetric === id}" data-act="chartMetric" data-metric="${id}">${m.label.replace('Organic ', '').replace('Ranking ', '')}</button>`).join('');
    return `<div class="tabs" role="tablist" aria-label="Chart metric">${tabs}</div>
      <div class="chart-host" data-chart-host></div>`;
  }

  U.drawCharts = function () {
    document.querySelectorAll('[data-chart-host]').forEach(host => {
      if (!U.gs) return;
      const w = host.clientWidth || host.parentElement.clientWidth || 320;
      host.innerHTML = SR.charts.trend(R.series(U.gs), U.chartMetric, w);
    });
  };

  /* ----- Actions view ----- */
  function actionCard(def, gs) {
    const hasV = !!def.variants;
    const costs = hasV ? def.variants.map(v => v.cost) : [def.cost];
    const aps = hasV ? def.variants.map(v => v.ap || 1) : [def.ap || 1];
    const cheapest = hasV ? def.variants.slice().sort((a, b) => a.cost - b.cost)[0].id : undefined;
    const check = A.canAfford(gs, def.id, cheapest);
    const used = gs.actionsThisMonth.filter(a => a.id === def.id).length;
    const risk = hasV ? (def.id === 'buildBacklinks' ? 'Low to High' : 'Low to Medium') : def.risk;
    const riskTone = /High/.test(risk) ? 'bad' : /Medium|Low to/.test(risk) ? 'warn' : 'good';
    const apText = Math.min(...aps) === Math.max(...aps) ? String(aps[0]) : `${Math.min(...aps)}-${Math.max(...aps)}`;
    return `<article class="acard cat-${def.cat}">
      <div class="acard-h"><span class="acard-ic">${U.icon(def.icon)}</span><div><h3>${def.name}</h3><span class="cat-tag">${CATS[def.cat]}</span></div>${used ? `<span class="chip good">Used ×${used}</span>` : ''}</div>
      <p class="acard-d">${def.desc}</p>
      <div class="acard-meta">
        <div><span>Cost</span><strong>${hasV ? 'From ' : ''}${money(Math.min(...costs))}</strong></div>
        <div><span>Action Points ${U.tip('ap')}</span><strong>${apText}</strong></div>
        <div><span>Risk ${U.tip('risk')}</span><strong class="risk ${riskTone}">${risk}</strong></div>
      </div>
      <div class="acard-pot"><span>Potential</span><ul>${def.potential.map(p => `<li>${p}</li>`).join('')}</ul></div>
      <button class="btn btn-primary btn-block" data-act="openAction" data-id="${def.id}" ${check.ok ? '' : 'disabled'}>EXECUTE</button>
      ${check.ok ? '' : `<p class="why">${check.reason}</p>`}
    </article>`;
  }

  VIEWS.actions = gs => `
    <div class="view-head"><div><p class="eyebrow">Month ${gs.month} · ${gs.actionPoints} action point${gs.actionPoints === 1 ? '' : 's'} · ${money(gs.budget)} available</p><h1>SEO Actions</h1></div></div>
    <p class="lead">Every action shows a range of likely effects, never exact results. Prioritise: different situations reward different moves.</p>
    <div class="grid">
      <div class="span-8"><div class="acards">${A.ORDER.map(id => actionCard(A.DEFS[id], gs)).join('')}</div></div>
      <div class="span-4 sticky-col">${monthActionsCard(gs)}${missionsCard(gs)}</div>
    </div>`;

  /* ----- Keywords view ----- */
  const compact = n => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K' : String(n));
  const potentialLabel = v => (v >= 2500 ? 'High' : v >= 1200 ? 'Medium' : 'Low');
  const diffLabel = d => (d < 35 ? 'Easy' : d < 55 ? 'Medium' : d < 75 ? 'Hard' : 'Very hard');
  const posBadge = p => `<span class="pos ${p <= 3 ? 'top' : p <= 10 ? 'p1' : p <= 20 ? 'p2' : ''}">${p >= 100 ? '100+' : p}</span>`;

  VIEWS.keywords = gs => {
    const all = gs.keywords.map(k => ({ ...k, change: k.prev - k.position }));
    const movers = all.filter(k => k.change > 0).sort((a, b) => b.change - a.change);
    const losing = all.filter(k => k.change < 0).sort((a, b) => a.change - b.change);
    const list = U.kwTab === 'up' ? movers : U.kwTab === 'down' ? losing : all.slice().sort((a, b) => a.position - b.position);
    const top = movers[0];
    const rows = list.map(k => `<tr>
      <th scope="row" data-label="Keyword"><span class="kw">${esc(k.term)}</span></th>
      <td data-label="Position">${posBadge(k.position)}</td>
      <td data-label="Previous">${posBadge(k.prev)}</td>
      <td data-label="Change"><span class="chg ${k.change > 0 ? 'up' : k.change < 0 ? 'down' : ''}">${k.change > 0 ? '↑ ' + k.change : k.change < 0 ? '↓ ' + Math.abs(k.change) : '—'}</span></td>
      <td data-label="Search potential"><span class="mini-meter" title="~${fmt(k.volume)} simulated monthly searches"><i style="width:${clamp(k.volume / 60, 6, 100)}%"></i></span> ${potentialLabel(k.volume)} <span class="fine">~${compact(k.volume)}</span></td>
      <td data-label="Difficulty"><span class="mini-meter diff"><i style="width:${k.difficulty}%"></i></span> ${diffLabel(k.difficulty)}</td></tr>`).join('');
    const tabs = [['all', `All (${all.length})`], ['up', `Top Movers (${movers.length})`], ['down', `Losing Keywords (${losing.length})`]]
      .map(([id, l]) => `<button role="tab" class="tab${U.kwTab === id ? ' active' : ''}" aria-selected="${U.kwTab === id}" data-act="kwTab" data-tab="${id}">${l}</button>`).join('');
    return `
      <div class="view-head"><div><p class="eyebrow">Fictional game keywords</p><h1>Keyword Rankings</h1></div></div>
      <div class="stat-tiles">
        <div class="stat-tile"><span>Tracked ${U.tip('keywords')}</span><strong>${all.length}</strong></div>
        <div class="stat-tile"><span>In top 10 ${U.tip('top10')}</span><strong>${all.filter(k => k.position <= 10).length}</strong></div>
        <div class="stat-tile"><span>Avg. position ${U.tip('position')}</span><strong>#${gs.avgPosition}</strong></div>
        <div class="stat-tile"><span>Biggest gain</span><strong>${top ? '↑ ' + top.change : '—'}</strong></div>
      </div>
      ${card('', `<div class="tabs" role="tablist" aria-label="Keyword filter">${tabs}</div>
        ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Keyword</th><th>Position ${U.tip('position')}</th><th>Previous</th><th>Change</th><th>Search potential ${U.tip('potential')}</th><th>Difficulty ${U.tip('difficulty')}</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="empty">Nothing here yet. Movement appears after your first month ends.</p>'}
        <p class="fine">These are fictional keywords and simulated positions. They are not real Google data.</p>`)}`;
  };

  /* ----- Competitors view ----- */
  VIEWS.competitors = gs => {
    const me = { name: 'Your website', authority: Math.round(S.authNorm(gs)), content: gs.contentScore, tech: gs.technicalScore };
    const stat = (label, v, key, tone) => `<div class="cbar"><div class="cbar-h"><span>${label}</span><strong>${Math.round(v)}</strong></div>${U.bar(key, v, tone)}</div>`;
    const comp = c => `<article class="card comp">
      <header class="comp-h"><span class="comp-ic">${c.id}</span><div><h3>Competitor ${c.id}</h3><span class="fine">${esc(c.name)} · ${R.PERSONALITIES[c.kind].label}</span></div></header>
      ${stat('Authority', c.authority, 'c' + c.id + 'a', 'amber')}${stat('Content Strength', c.content, 'c' + c.id + 'c', 'pink')}${stat('Technical Health', c.tech, 'c' + c.id + 't', 'green')}
      <div class="comp-growth"><span>Growth rate</span><strong class="${c.growth > 1.5 ? 'bad' : ''}">${gs.month > 1 || gs.phase === 'ended' ? '+' + c.growth.toFixed(1) + ' pts last month' : 'Not yet measured'}</strong></div>
    </article>`;
    const news = gs.competitorNews.map(n => `<li>${U.icon('fa-newspaper')} ${esc(n.text)}</li>`).join('');
    return `
      <div class="view-head"><div><p class="eyebrow">Simulated rivals</p><h1>Competitors</h1></div></div>
      <div class="grid">
        <div class="span-8">${card('Competitor Pressure ' + U.tip('pressure'), `
          <div class="press-top">${U.chip(S.pressureLabel(gs.pressure), S.pressureTone(gs.pressure))}<span class="fine">${gs.pressure > 0 ? `Rivals are about ${gs.pressure} points stronger overall.` : `You are about ${Math.abs(gs.pressure)} points stronger overall.`}</span></div>
          <ul class="news-list big">${news || '<li>No competitor activity yet.</li>'}</ul>
          <p class="fine">Competitor pressure nudges your keyword rankings. It is capped so rivals never become unfair, and they slow down when you are far behind.</p>`)}</div>
        <div class="span-4">${card('You', `<h4 class="sub-h">${esc(gs.websiteName)}</h4>${stat('Authority', me.authority, 'meA', 'amber')}${stat('Content Quality', me.content, 'meC', 'pink')}${stat('Technical Health', me.tech, 'meT', 'green')}`)}</div>
        ${gs.competitors.map(c => `<div class="span-4">${comp(c)}</div>`).join('')}
      </div>`;
  };

  /* ----- Growth view ----- */
  function historyItem(h, open) {
    const s = h.snap;
    const acts = h.actions.length ? h.actions.map(a => `<li>${U.icon('fa-check')} <strong>${esc(a.name)}</strong> <span class="fine">${money(a.cost)} · ${a.ap} AP</span><p>${esc(a.summary)}</p></li>`).join('') : '<li class="empty">No actions taken.</li>';
    return `<details class="hist" ${open ? 'open' : ''}><summary><strong>Month ${h.month}</strong><span>${fmt(s.traffic)} visitors · SEO ${s.seoScore}</span></summary>
      <div class="hist-body">
        <div class="hist-metrics">
          <div><span>Traffic</span><strong>${fmt(s.traffic)}</strong></div><div><span>Keywords</span><strong>${fmt(s.keywords)}</strong></div><div><span>Top 10</span><strong>${s.top10}</strong></div>
          <div><span>SEO Score</span><strong>${s.seoScore}</strong></div><div><span>Authority</span><strong>${s.authority}</strong></div><div><span>AI Vis.</span><strong>${s.aiVis}</strong></div>
        </div>
        <h4 class="sub-h">Actions · ${money(h.spent)} spent</h4><ul class="hist-acts">${acts}</ul>
        ${h.event ? `<p class="hist-line">${U.chip(esc(h.event.name), U.toneOf(h.event.tone), 'fa-bolt')}</p>` : ''}
        ${h.decision ? `<p class="hist-line">${U.chip('Decision: ' + esc(h.decision.choice), U.toneOf(h.decision.tone), 'fa-code-branch')}</p>` : ''}
        ${h.missions.length ? `<p class="hist-line">${h.missions.map(m => U.chip((m.done ? '✓ ' : '') + esc(m.title), m.done ? 'good' : 'neutral')).join(' ')}</p>` : ''}
        ${h.report ? `<p class="fine"><strong>Analyst note:</strong> ${esc(h.report.explanation)}</p>` : ''}
      </div></details>`;
  }

  VIEWS.growth = gs => {
    const hist = gs.monthlyHistory.slice().reverse();
    const current = gs.phase === 'playing' ? `<details class="hist now" open><summary><strong>Month ${gs.month} (in progress)</strong><span>${gs.actionsThisMonth.length} action${gs.actionsThisMonth.length === 1 ? '' : 's'} so far</span></summary><div class="hist-body"><ul class="hist-acts">${gs.actionsThisMonth.map(a => `<li>${U.icon('fa-check')} <strong>${esc(a.name)}</strong> <span class="fine">${money(a.cost)} · ${a.ap} AP</span><p>${esc(a.summary)}</p></li>`).join('') || '<li class="empty">No actions yet.</li>'}</ul></div></details>` : '';
    return `
      <div class="view-head"><div><p class="eyebrow">Monthly SEO trends</p><h1>Growth</h1></div></div>
      ${card('Trend Graph', trendBody())}
      ${card('Campaign History', `${current}${hist.map((h, i) => historyItem(h, false)).join('') || '<p class="empty">Finish your first month to start building your campaign history.</p>'}`)}`;
  };

  /* ----- Progress view (profile, missions, achievements) ----- */
  function profileCard(gs) {
    const p = SR.profile.load(), lvl = SR.profile.level(p.xp);
    return card('Player Profile', `
      <div class="prof-top"><span class="prof-badge">${lvl.level}</span><div><strong>${lvl.title}</strong><span class="fine">${lvl.next ? `${lvl.xp} / ${lvl.next} XP to next level` : 'Max level reached'}</span></div></div>
      ${U.bar('xp', lvl.pct, 'pink')}
      <div class="stat-tiles tight">
        <div class="stat-tile"><span>SEO Level</span><strong>${lvl.level}</strong></div>
        <div class="stat-tile"><span>Reputation ${U.tip('reputation')}</span><strong>${gs ? gs.reputation : p.reputation}</strong></div>
        <div class="stat-tile"><span>Achievements</span><strong>${Object.keys(p.achievements).length}/${AC.LIST.length}</strong></div>
        <div class="stat-tile"><span>Campaigns done</span><strong>${p.campaigns}</strong></div>
        <div class="stat-tile"><span>Best traffic</span><strong>${fmt(p.bestTraffic)}</strong></div>
        <div class="stat-tile"><span>Best SEO Score</span><strong>${p.bestSeoScore || '–'}</strong></div>
      </div>`);
  }

  function achievementsCard(gs) {
    const items = AC.LIST.map(a => {
      const done = !!gs.achievements[a.id];
      const pr = a.progress(gs);
      const pct = done ? 100 : Math.round(pr.f * 100);
      return `<article class="ach ${done ? 'unlocked' : 'locked'}">
        <span class="ach-ic">${U.icon(done ? a.icon : 'fa-lock')}</span>
        <div><div class="ach-h"><strong>${a.name}</strong>${done ? U.chip('Unlocked', 'good') : U.chip('Locked', 'neutral')}</div>
        <p>${a.desc}</p>${U.bar('ach-' + a.id, pct, done ? 'green' : 'pink')}<span class="fine">${done ? 'Unlocked in month ' + gs.achievements[a.id] : esc(pr.label)}</span></div></article>`;
    }).join('');
    return card(`Achievements (${Object.keys(gs.achievements).length}/${AC.LIST.length})`, `<div class="ach-grid">${items}</div>`);
  }

  VIEWS.progress = gs => `
    <div class="view-head"><div><p class="eyebrow">Missions, reputation &amp; achievements</p><h1>Progress</h1></div></div>
    <div class="grid">
      <div class="span-6">${profileCard(gs)}</div>
      <div class="span-6">${missionsCard(gs)}</div>
      <div class="span-12">${achievementsCard(gs)}</div>
    </div>`;

  U.profileCard = profileCard;
})();
