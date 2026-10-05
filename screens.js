/* ============================================================
   SEO RANKER — screens.js
   Onboarding flow and all modal screens (plan, action preview,
   event, decision, reports, GSC, final report, menus).
   ============================================================ */
(function () {
  'use strict';
  const SR = window.SR;
  const { fmt, money, esc, clamp } = SR;
  const U = SR.ui, S = SR.scoring, R = SR.ranking, A = SR.actions, E = SR.engine, M = SR.missions, EV = SR.events, AC = SR.achievements;
  const { icon, chip, tip, bar, num, toneOf } = U;

  /* ============================================================
     Screen switching + start screen
     ============================================================ */
  U.showScreen = function (id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  };

  U.refreshStart = function () {
    const saved = SR.save.read();
    const btn = document.getElementById('btn-continue');
    const hint = document.getElementById('continue-hint');
    btn.disabled = !saved;
    hint.hidden = false;
    hint.textContent = saved
      ? `Saved campaign: ${saved.websiteName}, Month ${saved.month} of ${SR.CONFIG.TOTAL_MONTHS}${saved.phase === 'ended' ? ' (finished)' : ''}.`
      : 'No saved game yet. Start a new campaign to begin.';
  };

  /* ============================================================
     Onboarding (3 steps)
     ============================================================ */
  const setup = { step: 1, type: null, diff: 'standard', pending: null };
  U.setup = setup;

  U.startSetup = function () {
    setup.step = 1; setup.type = null; setup.diff = 'standard'; setup.pending = null;
    U.showScreen('screen-setup');
    renderSetup();
  };

  function stepper() {
    const steps = ['Website', 'Difficulty', 'Mission'];
    return `<ol class="stepper" aria-label="Setup progress">${steps.map((s, i) =>
      `<li class="${setup.step === i + 1 ? 'now' : setup.step > i + 1 ? 'done' : ''}" ${setup.step === i + 1 ? 'aria-current="step"' : ''}><span>${setup.step > i + 1 ? '✓' : i + 1}</span>${s}</li>`).join('')}</ol>`;
  }

  function renderSetup() {
    const root = document.getElementById('setup-root');
    let body = '';
    if (setup.step === 1) {
      const cards = Object.values(SR.WEBSITE_TYPES).map(t => `
        <button type="button" role="radio" aria-checked="${setup.type === t.id}" class="opt-card${setup.type === t.id ? ' selected' : ''}" data-act="pickType" data-id="${t.id}">
          <span class="opt-ic">${icon(t.icon)}</span>
          <h3>${t.name}</h3><p>${t.blurb}</p>
          <dl class="opt-stats">
            <div><dt>Starting traffic</dt><dd>${t.traffic}/mo</dd></div>
            <div><dt>Starting authority</dt><dd>${t.authority}</dd></div>
            <div><dt>SEO difficulty</dt><dd><span class="dots" aria-label="${t.dots} out of 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= t.dots ? 'on' : ''}"></i>`).join('')}</span></dd></div>
          </dl>
          <p class="challenge"><strong>Primary challenge</strong>${t.challenge}</p>
        </button>`).join('');
      body = `<h1>Choose your website type</h1><p class="lead">Each type starts from a different position and faces a different challenge.</p>
        <div class="opt-grid" role="radiogroup" aria-label="Website type">${cards}</div>`;
    } else if (setup.step === 2) {
      const cards = Object.values(SR.DIFFICULTIES).map(d => `
        <button type="button" role="radio" aria-checked="${setup.diff === d.id}" class="opt-card${setup.diff === d.id ? ' selected' : ''}" data-act="pickDiff" data-id="${d.id}">
          <span class="opt-ic">${icon(d.icon)}</span><h3>${d.name}</h3><p>${d.blurb}</p>
          <dl class="opt-stats">
            <div><dt>Monthly budget</dt><dd>${money(d.budget)}</dd></div>
            <div><dt>Competition</dt><dd>${d.competitionLabel}</dd></div>
            <div><dt>Event frequency</dt><dd>${d.eventsLabel}</dd></div>
            <div><dt>Recovery</dt><dd>${d.recoveryLabel}</dd></div>
          </dl>
        </button>`).join('');
      body = `<h1>Choose your difficulty</h1><p class="lead">Difficulty changes your budget, how hard rivals push, how often events strike and how quickly you recover.</p>
        <div class="opt-grid three" role="radiogroup" aria-label="Difficulty">${cards}</div>`;
    } else {
      if (!setup.pending || setup.pending.websiteType !== setup.type || setup.pending.difficulty !== setup.diff) setup.pending = E.newCampaign(setup.type, setup.diff);
      const g = setup.pending, T = SR.WEBSITE_TYPES[g.websiteType], D = SR.DIFFICULTIES[g.difficulty];
      body = `<h1>Your mission</h1>
        <div class="mission-card">
          <p class="eyebrow">${esc(T.name)} · ${D.name}</p>
          <p class="mission-quote">Grow organic traffic while maintaining a healthy SEO foundation.</p>
          <p class="lead">You have 12 months and 3 action points each month. Balance quick wins against long-term strength, because shortcuts have a cost.</p>
        </div>
        <div class="grid">
          <div class="span-6"><section class="card"><header class="card-h"><h3>Your starting audit</h3></header>
            <div class="stat-tiles tight">
              <div class="stat-tile"><span>Organic traffic</span><strong>${fmt(g.organicTraffic)}</strong></div>
              <div class="stat-tile"><span>Ranking keywords</span><strong>${g.rankingKeywords}</strong></div>
              <div class="stat-tile"><span>SEO Score</span><strong>${g.seoScore}</strong></div>
              <div class="stat-tile"><span>Authority</span><strong>${g.authority}</strong></div>
              <div class="stat-tile"><span>Monthly budget</span><strong>${money(g.budget)}</strong></div>
              <div class="stat-tile"><span>Competitors</span><strong>${g.competitors.length}</strong></div>
            </div>
            <p class="fine">Every new campaign gets slightly different starting conditions, keywords, competitors and missions.</p></section></div>
          <div class="span-6"><section class="card"><header class="card-h"><h3>Campaign goals</h3></header>
            <ul class="goal-list">
              <li>${icon('fa-arrow-trend-up')} Grow organic traffic as far as you can</li>
              <li>${icon('fa-gauge-high')} Build an SEO Score of 75 or more</li>
              <li>${icon('fa-ranking-star')} Move keywords onto page one</li>
              <li>${icon('fa-heart-pulse')} Keep your site healthy and your links clean</li>
            </ul>
            <p class="fine">Aim for a final grade of S. Sustainable strategies are rewarded.</p></section></div>
        </div>`;
    }
    const canNext = setup.step === 1 ? !!setup.type : true;
    const back = setup.step === 1 ? 'Back' : 'Previous';
    const forward = setup.step === 3
      ? `<button class="btn btn-primary btn-lg" data-act="startCampaign">${icon('fa-rocket')} START CAMPAIGN</button>`
      : `<button class="btn btn-primary btn-lg" data-act="setupNext" ${canNext ? '' : 'disabled'}>Continue ${icon('fa-arrow-right')}</button>`;
    root.innerHTML = `<div class="setup-head"><button class="btn btn-ghost" data-act="setupBack">${icon('fa-arrow-left')} ${back}</button>${stepper()}</div>
      <div class="setup-body">${body}</div><div class="setup-foot">${forward}</div>`;
    const sel = root.querySelector('.selected') || root.querySelector('h1');
    if (sel) sel.setAttribute('tabindex', '-1');
  }
  U.renderSetup = renderSetup;

  /* ============================================================
     Flow sync: open the modal that matches the saved game stage
     ============================================================ */
  U.syncFlow = function () {
    const gs = U.gs;
    if (!gs) return;
    U.closeFlowModals();
    const st = gs.flow.stage;
    if (st === 'plan') openPlan();
    else if (st === 'event') openEvent();
    else if (st === 'decision') openDecision();
    else if (st === 'decisionResult') openDecisionResult();
    else if (st === 'report') openReport();
    else if (st === 'final') U.openFinal();
  };

  /* ---------- Month planning ---------- */
  function openPlan() {
    const gs = U.gs;
    const focus = E.focus(gs);
    const body = `
      <p class="eyebrow">Current situation</p>
      <p class="situation lg">${esc(E.situation(gs))}</p>
      <div class="signals">${E.signals(gs).map(s => chip(esc(s.text), s.tone)).join('')}</div>
      <h4 class="sub-h">Recommended focus</h4>
      <ul class="focus-list">${focus.map(f => `<li class="focus-item cat-${f.cat}"><strong>${f.area}</strong><span>${esc(f.reason)}</span></li>`).join('') || '<li class="focus-item"><span>Fundamentals look balanced. Look to expand keywords and authority.</span></li>'}</ul>
      <h4 class="sub-h">Optional missions</h4>
      <ul class="mini-missions">${gs.missions.map(m => `<li>${icon('fa-bullseye')}<span>${esc(m.title)}</span><em>+${money(m.reward.budget)}</em></li>`).join('')}</ul>
      <p class="fine">These are suggestions only. You make every decision.</p>
      <div class="mini-stats"><div><span>Budget</span><strong>${money(gs.budget)}</strong></div><div><span>Action points</span><strong>${gs.actionPoints}</strong></div><div><span>Competitor pressure</span><strong>${S.pressureLabel(gs.pressure)}</strong></div></div>`;
    U.openModal({ id: 'plan', flow: true, dismissible: false, size: 'md', eyebrow: `Month ${gs.month} of ${SR.CONFIG.TOTAL_MONTHS}`, title: `MONTH ${gs.month}`, body,
      footer: `<button class="btn btn-primary btn-lg" data-act="startMonth" data-autofocus>${icon('fa-play')} Start Month ${gs.month}</button>` });
  }

  /* ---------- Action preview ---------- */
  const preview = { id: null, variant: null };
  const defaultVariant = def => (def.variants ? (def.variants[1] || def.variants[0]).id : null);

  function previewBody() {
    const gs = U.gs, def = A.DEFS[preview.id];
    const p = A.preview(gs, preview.id, preview.variant);
    const variants = def.variants ? `<div class="variants" role="radiogroup" aria-label="Choose an approach">${def.variants.map(v => {
      const risk = v.risk;
      return `<button type="button" role="radio" aria-checked="${v.id === preview.variant}" class="variant${v.id === preview.variant ? ' selected' : ''}" data-act="pickVariant" data-v="${v.id}">
        <div class="variant-h"><strong>${v.name}</strong>${v.label ? chip(v.label + ' quality', v.label === 'Low' ? 'bad' : v.label === 'Medium' ? 'warn' : 'good') : ''}</div>
        <p>${v.blurb}</p><div class="variant-m"><span>${money(v.cost)}</span><span>${v.ap || 1} AP</span><span class="risk ${risk === 'High' ? 'bad' : risk === 'Medium' ? 'warn' : 'good'}">${risk} risk</span></div></button>`;
    }).join('')}</div>` : '';
    const rows = p.previewRows.map(r => `<li><span>${r.label}</span><strong class="${r.tone}">${esc(r.value)}</strong></li>`).join('');
    const notes = p.notes.length ? `<ul class="notes">${p.notes.map(n => `<li>${icon('fa-circle-info')} ${esc(n)}</li>`).join('')}</ul>` : '';
    return `<p class="lead tight">${def.desc}</p>${variants}
      <h4 class="sub-h">Expected impact</h4><ul class="impact">${rows}</ul>${notes}
      <p class="fine">Ranges only. Exact results are never revealed, and SEO outcomes always carry some uncertainty.</p>`;
  }
  function previewFooter() {
    const gs = U.gs;
    const p = A.resolve(gs, preview.id, preview.variant);
    const ok = A.canAfford(gs, preview.id, preview.variant);
    return `<button class="btn btn-ghost" data-act="closeModal">Cancel</button>
      <button class="btn btn-primary" data-act="confirmAction" ${ok.ok ? '' : 'disabled'}>${icon('fa-bolt')} Execute · ${money(p.cost)} · ${p.ap} AP</button>${ok.ok ? '' : `<p class="why">${ok.reason}</p>`}`;
  }
  U.openAction = function (id) {
    const def = A.DEFS[id];
    preview.id = id; preview.variant = defaultVariant(def);
    U.openModal({ id: 'action', size: 'md', eyebrow: 'Impact preview', title: def.name, body: previewBody(), footer: previewFooter() });
  };
  U.pickVariant = function (v) {
    preview.variant = v;
    U.setModal('action', previewBody(), previewFooter());
    const b = document.querySelector(`#modal-root [data-v="${v}"]`);
    if (b) b.focus({ preventScroll: true });
  };
  U.previewState = preview;

  /* ---------- Event ---------- */
  function openEvent() {
    const ev = U.gs.flow.event;
    const tone = toneOf(ev.tone);
    const body = `<div class="event-hero ${tone}"><span class="event-ic">${icon(ev.icon)}</span>
        ${chip(tone === 'good' ? 'Opportunity' : tone === 'bad' ? 'Setback' : 'Mixed news', tone)}
        <h3>${esc(ev.name)}</h3></div>
      <p class="event-desc">${esc(ev.description)}</p>
      ${ev.chips.length ? `<h4 class="sub-h">What changed</h4><div class="chips">${ev.chips.map(c => chip(`${c.label} ${c.text}`, c.tone)).join('')}</div>` : '<p class="fine">No major metric changes.</p>'}
      <p class="fine">Events depend partly on your own strategy: weak foundations invite problems, strong ones attract opportunities.</p>`;
    U.openModal({ id: 'event', flow: true, dismissible: false, size: 'sm', eyebrow: 'SEO event', title: 'Something happened', body,
      footer: `<button class="btn btn-primary" data-act="afterEvent" data-autofocus>Continue</button>` });
  }

  /* ---------- Decision ---------- */
  function openDecision() {
    const gs = U.gs;
    const d = EV.getDecision(gs.flow.decisionId);
    const opts = d.options.map((o, i) => {
      const afford = gs.budget >= o.cost;
      return `<article class="dopt${afford ? '' : ' off'}">
        <div class="dopt-h"><span class="dopt-n">${i + 1}</span><strong>${esc(o.label)}</strong><span class="dopt-cost">${o.cost ? money(o.cost) : 'Free'}</span></div>
        <dl><div><dt>${icon('fa-circle-plus')} Potential benefit</dt><dd>${esc(o.benefit)}</dd></div><div><dt>${icon('fa-triangle-exclamation')} Potential risk</dt><dd>${esc(o.risk)}</dd></div></dl>
        <button class="btn btn-secondary btn-block" data-act="decide" data-id="${o.id}" ${afford ? '' : 'disabled'}>${afford ? 'Choose this' : 'Not enough budget'}</button></article>`;
    }).join('');
    const body = `<div class="dsec"><p class="eyebrow">Situation</p><p class="situation">${esc(d.situation)}</p></div>
      <div class="dsec"><p class="eyebrow">Context</p><p>${esc(d.context(gs))}</p></div>
      <p class="eyebrow">Your options · budget ${money(gs.budget)}</p><div class="dopts">${opts}</div>
      <p class="fine">There is rarely one obviously correct answer. The right move depends on your situation.</p>`;
    U.openModal({ id: 'decision', flow: true, dismissible: false, size: 'lg', eyebrow: 'Strategic decision', title: esc(d.title), body });
  }

  function openDecisionResult() {
    const r = U.gs.flow.result;
    const tone = toneOf(r.tone);
    const body = `<div class="event-hero ${tone}"><span class="event-ic">${icon(tone === 'good' ? 'fa-circle-check' : tone === 'bad' ? 'fa-circle-xmark' : 'fa-scale-balanced')}</span><h3>${esc(r.choice)}</h3></div>
      <p class="event-desc">${esc(r.summary)}</p>
      ${r.chips.length ? `<div class="chips">${r.chips.map(c => chip(`${c.label} ${c.text}`, c.tone)).join('')}</div>` : ''}`;
    U.openModal({ id: 'decisionResult', flow: true, dismissible: false, size: 'sm', eyebrow: 'Decision outcome', title: esc(r.title), body,
      footer: `<button class="btn btn-primary" data-act="afterDecision" data-autofocus>Continue</button>` });
  }

  /* ---------- Monthly report ---------- */
  function deltaChip(m) {
    const d = m.after - m.before;
    if (!d) return chip('No change', 'neutral');
    const pct = ['traffic', 'keywords', 'revenue'].includes(m.key);
    const text = pct ? `${d > 0 ? '+' : '−'}${Math.abs(Math.round(SR.pct(m.after, m.before)))}%` : `${d > 0 ? '+' : '−'}${Math.abs(Math.round(d))}`;
    return chip(text, d > 0 ? 'good' : 'bad');
  }

  function openReport() {
    const gs = U.gs, r = gs.flow.report;
    const tiles = r.metrics.map(m => `<div class="rtile"><span>${m.label}</span><strong>${num('rp-' + m.key, m.after, m.money)}</strong><em>${m.money ? money(m.before) : fmt(m.before)} → ${m.money ? money(m.after) : fmt(m.after)}</em>${deltaChip(m)}</div>`).join('');
    const list = items => `<ul class="rlist">${items.map(t => `<li>${esc(t)}</li>`).join('') || '<li class="empty">Nothing notable.</li>'}</ul>`;
    const mis = r.missions.length ? `<h4 class="sub-h">Missions</h4><ul class="mini-missions">${r.missions.map(m => `<li class="${m.done ? 'done' : ''}">${icon(m.done ? 'fa-circle-check' : 'fa-circle-xmark')}<span>${esc(m.title)}</span><em>${m.done ? '+' + money(m.reward.budget) : 'Missed'}</em></li>`).join('')}</ul>` : '';
    const ach = r.achievements.length ? `<div class="chips">${r.achievements.map(id => chip(AC.byId(id).name, 'good', 'fa-trophy')).join('')}</div>` : '';
    const last = gs.month >= SR.CONFIG.TOTAL_MONTHS;
    const body = `<div class="rtiles">${tiles}</div>
      <div class="cols"><div><h4 class="sub-h good">What worked</h4>${list(r.worked)}</div><div><h4 class="sub-h bad">What hurt</h4>${list(r.hurt)}</div></div>
      <div class="insights">
        <div class="insight good"><span>Biggest win</span><p>${esc(r.biggestWin)}</p></div>
        <div class="insight bad"><span>Biggest risk</span><p>${esc(r.biggestRisk)}</p></div>
        <div class="insight next"><span>Next month opportunity</span><p>${esc(r.nextOpportunity)}</p></div>
      </div>
      <div class="analyst"><p class="eyebrow">${icon('fa-wand-magic-sparkles')} Analyst note</p><p>${esc(r.explanation)}</p><span class="fine">Written locally from game logic. No external AI is used.</span></div>
      ${r.news.length ? `<p class="fine">${icon('fa-chess-knight')} ${r.news.map(esc).join(' · ')}</p>` : ''}
      ${mis}${ach}
      ${r.repDelta ? `<p class="fine">Reputation ${r.repDelta > 0 ? 'rose' : 'fell'} ${Math.abs(r.repDelta)} this month.</p>` : ''}`;
    U.openModal({ id: 'report', flow: true, dismissible: false, size: 'lg', eyebrow: 'End of month report', title: `Month ${r.month} complete`, body,
      footer: `<button class="btn btn-primary btn-lg" data-act="afterReport" data-autofocus>${icon(last ? 'fa-flag-checkered' : 'fa-forward')} ${last ? 'View Final Report' : `Continue to Month ${gs.month + 1}`}</button>` });
  }

  /* ---------- SEO score breakdown ---------- */
  U.openBreakdown = function () {
    const gs = U.gs, ex = S.explain(gs);
    const rows = ex.comps.map(c => `<li class="bk ${c.status}">
      <div class="bk-h"><strong>${icon(c.icon)} ${c.label} ${tip(c.id === 'authority' ? 'authority' : c.id)}</strong><span>${c.value}/100 · weight ${Math.round(c.weight * 100)}%</span></div>
      ${bar('bk-' + c.id, c.value, c.status === 'helping' ? 'green' : c.status === 'hurting' ? 'red' : 'amber')}
      <p>${chip(c.status === 'helping' ? 'Helping' : c.status === 'hurting' ? 'Hurting' : 'Neutral', c.status === 'helping' ? 'good' : c.status === 'hurting' ? 'bad' : 'warn')} ${esc(c.text)}</p></li>`).join('');
    const extras = ex.extras.length ? `<h4 class="sub-h">Other factors</h4><ul class="rlist">${ex.extras.map(x => `<li class="${x.status === 'helping' ? 'ok' : ''}">${esc(x.text)}</li>`).join('')}</ul>` : '';
    const body = `<div class="bk-top"><div class="ring-wrap">${SR.charts.ring(gs.seoScore, 112, 11)}<div class="ring-center"><strong>${gs.seoScore}</strong><span>/ 100</span></div></div>
      <p>${chip(S.scoreLevel(gs.seoScore).label, toneOf(S.scoreLevel(gs.seoScore).tone))} Your SEO Score is a weighted blend of five areas. Raise the weakest ones that carry the most weight.</p></div>
      <ul class="bk-list">${rows}</ul>${extras}`;
    U.openModal({ id: 'breakdown', size: 'md', title: 'SEO Score breakdown', body, footer: '<button class="btn btn-primary" data-act="closeModal" data-autofocus>Close</button>' });
  };

  /* ---------- Simulated GSC ---------- */
  U.openGSC = function () {
    const d = E.gscData(U.gs);
    const q = d.queries.map(x => `<tr><th scope="row" data-label="Query"><span class="kw">${esc(x.term)}</span></th><td data-label="Clicks">${fmt(x.clicks)}</td><td data-label="Impressions">${fmt(x.impressions)}</td><td data-label="Position">${posBadge(x.position)}</td></tr>`).join('');
    const pages = (arr, sign) => arr.length ? `<ul class="rlist">${arr.map(p => `<li><code>${esc(p.page)}</code> <strong class="${sign > 0 ? 'good' : 'bad'}">${sign > 0 ? '+' : '−'}${fmt(Math.abs(p.delta))} clicks</strong></li>`).join('')}</ul>` : '<p class="fine">No movement yet. Rankings update when a month ends.</p>';
    const alerts = d.alerts.map(a => `<li class="alert-${a.sev}">${icon(a.sev === 'ok' ? 'fa-circle-check' : 'fa-triangle-exclamation')} ${esc(a.text)}</li>`).join('');
    const body = `<div class="sim-banner">${icon('fa-flask')} <strong>SIMULATED GSC DATA</strong> <span>A game mechanic. This is not real Google Search Console data.</span></div>
      <div class="stat-tiles">
        <div class="stat-tile"><span>Clicks</span><strong>${fmt(d.clicks)}</strong></div>
        <div class="stat-tile"><span>Impressions ${tip('impressions')}</span><strong>${fmt(d.impressions)}</strong></div>
        <div class="stat-tile"><span>CTR ${tip('ctr')}</span><strong>${(d.ctr * 100).toFixed(1)}%</strong></div>
        <div class="stat-tile"><span>Avg. position ${tip('position')}</span><strong>${d.avgPosition}</strong></div>
      </div>
      <h4 class="sub-h">Top queries</h4>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Query</th><th>Clicks</th><th>Impressions</th><th>Position</th></tr></thead><tbody>${q}</tbody></table></div>
      <div class="cols"><div><h4 class="sub-h good">Pages gaining clicks</h4>${pages(d.gaining, 1)}</div><div><h4 class="sub-h bad">Pages losing clicks</h4>${pages(d.losing, -1)}</div></div>
      <h4 class="sub-h">Indexing alerts</h4><ul class="alerts">${alerts}</ul>
      <div class="analyst"><p class="eyebrow">${icon('fa-lightbulb')} Suggested next move</p><p>${esc(d.tip)}</p></div>`;
    U.openModal({ id: 'gsc', size: 'lg', eyebrow: 'Search Console (simulated)', title: 'GSC analysis', body, footer: '<button class="btn btn-primary" data-act="closeModal" data-autofocus>Close report</button>' });
  };
  const posBadge = p => `<span class="pos ${p <= 3 ? 'top' : p <= 10 ? 'p1' : p <= 20 ? 'p2' : ''}">${p >= 100 ? '100+' : p}</span>`;

  /* ---------- Achievement popup ---------- */
  U.openAchievement = function (a) {
    U.openModal({ id: 'ach', size: 'sm', eyebrow: 'Achievement unlocked', title: esc(a.name),
      body: `<div class="ach-pop"><span class="ach-ic big">${icon(a.icon)}</span><p>${esc(a.desc)}</p></div>`,
      footer: '<button class="btn btn-primary" data-act="closeModal" data-autofocus>Nice!</button>' });
  };

  /* ---------- How to play ---------- */
  U.openHowTo = function () {
    const items = [
      ['fa-calendar-days', 'A 12-month campaign', 'Each month you plan, take actions, then end the month to see what happened.'],
      ['fa-bolt', '3 action points', 'Every action uses at least one. Some premium moves use two.'],
      ['fa-indian-rupee-sign', 'A monthly budget', 'Spend it on actions and decisions. Half of what you save carries over.'],
      ['fa-eye', 'Impact previews', 'Before executing, see likely effect ranges. Exact results stay hidden.'],
      ['fa-chess-knight', 'Living competitors', 'Rivals improve every month and add ranking pressure.'],
      ['fa-dice', 'Events & decisions', 'Your own strategy changes which events appear. Decisions rarely have one right answer.']
    ].map(([ic, h, p]) => `<div class="how"><span>${icon(ic)}</span><h4>${h}</h4><p>${p}</p></div>`).join('');
    const body = `<div class="how-grid">${items}</div>
      <h4 class="sub-h">What the game is teaching</h4>
      <ul class="rlist"><li>Prioritise: technical health, content quality, authority, internal linking and user experience all matter.</li><li>Quality beats quantity: spammy links and thin content create long-term problems.</li><li>SEO takes time, and rankings fluctuate from month to month.</li><li>Sustainable strategies are rewarded over short-term tricks.</li></ul>
      <div class="notice">${icon('fa-circle-info')} ${SR.CONFIG.DISCLAIMER}</div>`;
    U.openModal({ id: 'howto', size: 'md', title: 'How to play', body, footer: '<button class="btn btn-primary" data-act="closeModal" data-autofocus>Got it</button>' });
  };

  /* ---------- Menu & confirmations ---------- */
  U.openMenu = function () {
    const items = [
      ['saveGame', 'fa-floppy-disk', 'Save game', 'Your progress also saves automatically.'],
      ['goProgress', 'fa-trophy', 'Achievements & profile', 'Missions, reputation and your player level.'],
      ['howTo', 'fa-circle-question', 'How to play', 'Rules, tips and the simulation disclaimer.'],
      ['toTitle', 'fa-house', 'Back to title screen', 'Your campaign stays saved.'],
      ['confirmReset', 'fa-rotate-left', 'Reset game', 'Delete this campaign and start over.']
    ].map(([act, ic, h, p]) => `<button class="menu-item${act === 'confirmReset' ? ' danger' : ''}" data-act="${act}">${icon(ic)}<div><strong>${h}</strong><span>${p}</span></div></button>`).join('');
    U.openModal({ id: 'menu', size: 'sm', title: 'Menu', body: `<div class="menu-list">${items}</div>` });
  };

  U.openConfirm = function (id, title, text, confirmAct, confirmLabel, danger) {
    U.openModal({ id, size: 'sm', title, body: `<p>${text}</p>`,
      footer: `<button class="btn btn-ghost" data-act="closeModal" data-autofocus>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="${confirmAct}">${confirmLabel}</button>` });
  };

  /* ---------- Final report ---------- */
  U.openFinal = function () {
    const gs = U.gs, f = E.finalReport(gs);
    const fmtVal = (r, v) => (r.money ? money(v) : r.of100 ? v : fmt(v));
    const rows = f.rows.map(r => `<tr><th scope="row" data-label="Metric">${r.label}</th><td data-label="Starting">${fmtVal(r, r.before)}</td><td data-label="Final"><strong>${fmtVal(r, r.after)}</strong></td><td data-label="Growth">${r.growth === null ? (r.after > 0 ? chip('New', 'good') : chip('No change', 'neutral')) : chip(`${r.growth >= 0 ? '+' : '−'}${Math.abs(r.growth)}%`, r.growth >= 0 ? 'good' : 'bad')}</td></tr>`).join('');
    const best = f.best.length ? f.best.map(b => `<li><strong>${esc(b.title)}</strong><span class="fine">Month ${b.month} · impact +${b.impact}</span><p>${esc(b.detail)}</p></li>`).join('') : '<li class="empty">No standout decisions were recorded.</li>';
    const bad = f.mistakes.length ? f.mistakes.map(b => `<li><strong>${esc(b.title)}</strong>${b.month ? `<span class="fine">Month ${b.month}</span>` : ''}<p>${esc(b.detail)}</p></li>`).join('') : '<li class="empty">No serious mistakes. Well played.</li>';
    const ach = f.achievements.length ? f.achievements.map(id => chip(AC.byId(id).name, 'good', AC.byId(id).icon)).join('') : '<span class="fine">None unlocked this campaign.</span>';
    const share = E.shareText(gs);
    const body = `
      <div class="final-hero"><div class="grade g-${f.grade}">${f.grade}</div><div><p class="eyebrow">Final grade</p><h3>${f.title}</h3><p class="fine">${esc(gs.websiteName)} · ${SR.DIFFICULTIES[gs.difficulty].name} · reputation ${gs.reputation} · total revenue ${money(f.totalRevenue)}</p></div></div>
      <h4 class="sub-h">Starting performance vs final performance</h4>
      <div class="tbl-wrap"><table class="tbl final-tbl"><thead><tr><th>Metric</th><th>Starting</th><th>Final</th><th>Growth</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="cols"><div><h4 class="sub-h good">Top 5 best decisions</h4><ol class="deci">${best}</ol></div><div><h4 class="sub-h bad">Top 3 mistakes</h4><ol class="deci">${bad}</ol></div></div>
      <div class="insights"><div class="insight good"><span>Biggest growth month</span><p>${esc(f.biggestGrowth)}</p></div><div class="insight bad"><span>Biggest challenge</span><p>${esc(f.challenge)}</p></div></div>
      <div class="analyst"><p class="eyebrow">Final strategy summary</p><p>${esc(f.summary)}</p></div>
      <h4 class="sub-h">Achievements unlocked</h4><div class="chips">${ach}</div>
      <h4 class="sub-h">Share your result</h4>
      <textarea id="share-text" class="share" readonly rows="10" aria-label="Shareable result summary">${esc(share)}</textarea>
      <div class="notice">${icon('fa-circle-info')} ${SR.CONFIG.DISCLAIMER}</div>`;
    U.openModal({ id: 'final', flow: true, size: 'xl', eyebrow: '12-month campaign report', title: 'Final report', body,
      footer: `<button class="btn btn-ghost" data-act="playAgain">${icon('fa-rotate-left')} Play again</button>
        <button class="btn btn-secondary" id="btn-copy" data-act="copyResult">${icon('fa-copy')} COPY RESULT</button>
        <button class="btn btn-primary" data-act="closeModal" data-autofocus>${icon('fa-eye')} View final dashboard</button>` });
  };
})();
