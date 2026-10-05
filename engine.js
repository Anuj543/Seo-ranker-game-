/* ============================================================
   SEO RANKER — engine.js
   Campaign flow (month simulation, events, reports), local
   "AI-style" explanations, simulated GSC data and the final
   report. No DOM access, so it can be run headless.
   ============================================================ */
(function () {
  'use strict';
  const SR = window.SR;
  const { clamp, cap, rand, randInt, pick, fmt, money, CONFIG } = SR;
  const S = SR.scoring, R = SR.ranking, A = SR.actions, EV = SR.events, M = SR.missions, AC = SR.achievements;

  const E = (SR.engine = {});

  const pctText = (a, b) => { const p = Math.round(SR.pct(b, a)); return `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}%`; };
  const slug = t => '/' + t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  /* ============================================================
     Campaign lifecycle
     ============================================================ */
  E.newCampaign = function (typeId, diffId) {
    const gs = R.createGame(typeId, diffId);
    gs.monthLog = { event: null, decision: null };
    gs.missions = M.generate(gs);
    M.stamp(gs);
    gs.flow = { stage: 'plan' };
    return gs;
  };

  E.log = function (gs, tone, icon, title, text) {
    gs.eventLog.unshift({ month: gs.month, tone, icon, title, text });
    if (gs.eventLog.length > 40) gs.eventLog.pop();
  };

  /* Player runs an action */
  E.act = function (gs, id, vid) {
    const res = A.perform(gs, id, vid);
    if (!res.ok) return res;
    res.missions = M.evaluate(gs);
    res.achievements = AC.check(gs);
    SR.profile.noteAchievements(res.achievements.map(a => a.id));
    E.log(gs, res.entry.tone, A.DEFS[id].icon, res.entry.shortName, res.entry.summary);
    res.missions.forEach(m => E.log(gs, 'success', 'fa-bullseye', 'Mission complete', m.title));
    res.achievements.forEach(a => E.log(gs, 'success', 'fa-trophy', 'Achievement unlocked', a.name));
    return res;
  };

  /* ---------- End of month: simulate, then roll event/decision ---------- */
  E.endMonth = function (gs) {
    if (gs.phase !== 'playing' || gs.flow.stage !== 'play') return;
    gs.stats.unusedAP += gs.actionPoints;
    simulateMonth(gs);
    const event = EV.rollEvent(gs);
    const decisionId = EV.rollDecision(gs);
    gs.monthLog.event = event ? { name: event.name, tone: event.tone, chips: event.chips } : null;
    if (event) E.log(gs, event.tone === 'good' ? 'success' : event.tone === 'bad' ? 'danger' : 'warning', event.icon, event.name, event.description);
    if (event) gs.flow = { stage: 'event', event, decisionId };
    else if (decisionId) gs.flow = { stage: 'decision', decisionId };
    else E.closeMonth(gs);
  };

  function simulateMonth(gs) {
    const decay = {};
    R.updateCompetitors(gs);

    // Natural decay: SEO needs ongoing maintenance
    const hadTech = gs.actionsThisMonth.some(a => a.id === 'technicalSEO' || a.id === 'pageExperience');
    decay.content = gs.contentDebt > 20 ? 2 : (Math.random() < 0.6 ? 1 : 0);
    decay.technical = (hadTech || Math.random() < 0.35 ? 0 : 1) + (gs.rankingKeywords > 150 && Math.random() < 0.5 ? 1 : 0);
    decay.ux = Math.random() < 0.5 ? 1 : 0;
    decay.linking = Math.random() < 0.4 ? 1 : 0;
    gs.contentScore = cap(gs.contentScore - decay.content);
    gs.technicalScore = cap(gs.technicalScore - decay.technical);
    gs.userExperience = cap(gs.userExperience - decay.ux);
    gs.internalLinking = cap(gs.internalLinking - decay.linking);
    if (Math.random() < 0.4) gs.topicalAuthority = cap(gs.topicalAuthority - 1);
    gs.toxicity = Math.max(0, gs.toxicity - 1);
    // Health drifts toward the quality of the foundations
    const target = gs.technicalScore * 0.6 + gs.userExperience * 0.4;
    gs.seoHealth = cap(gs.seoHealth + (target - gs.seoHealth) * 0.2);
    gs.stats.techNeglectMonths = gs.technicalScore < 40 ? gs.stats.techNeglectMonths + 1 : 0;
    // Content debt gradually costs keywords
    if (gs.contentDebt > 20) gs.rankingKeywords = Math.max(1, gs.rankingKeywords - Math.round(gs.rankingKeywords * 0.02 * ((gs.contentDebt - 20) / 10 + 1)));
    gs.monthDecay = decay;

    R.refreshDerived(gs);
    R.updateKeywords(gs);
    R.updateTraffic(gs);
    if (gs.demand.monthsLeft > 0) {
      gs.demand.monthsLeft -= 1;
      if (gs.demand.monthsLeft === 0) gs.demand = { mod: 1, monthsLeft: 0, label: '' };
    }
    R.refreshDerived(gs);
  }

  /* Event acknowledged */
  E.afterEvent = function (gs) {
    const id = gs.flow.decisionId;
    if (id) gs.flow = { stage: 'decision', decisionId: id };
    else E.closeMonth(gs);
  };

  /* Player picks a decision option */
  E.decide = function (gs, optionId) {
    const res = EV.chooseOption(gs, gs.flow.decisionId, optionId);
    if (!res.ok) return res;
    E.log(gs, res.tone === 'bad' ? 'danger' : res.tone === 'warn' ? 'warning' : 'info', 'fa-code-branch', `Decision: ${res.choice}`, res.summary);
    gs.monthLog.decision = { title: res.title, choice: res.choice, summary: res.summary, tone: res.tone, impact: res.impact };
    gs.reputation = cap(gs.reputation + (res.tone === 'success' ? 1 : res.tone === 'bad' ? -2 : 0));
    gs.flow = { stage: 'decisionResult', result: res };
    return res;
  };
  E.afterDecision = function (gs) { E.closeMonth(gs); };

  /* ---------- Close month: finalise metrics and build the report ---------- */
  E.closeMonth = function (gs) {
    const before = R.series(gs).slice(-1)[0];
    R.refreshDerived(gs);
    gs.totalRevenue += gs.monthlyRevenue;

    // Reputation: sustainable growth and healthy foundations earn trust
    const tp = SR.pct(gs.organicTraffic, before.traffic);
    let rep = 0;
    if (gs.seoHealth >= 70) rep += 1; else if (gs.seoHealth < 40) rep -= 2;
    if (tp >= 5 && gs.seoHealth >= 55 && gs.toxicity < 20) rep += 1;
    if (tp <= -10) rep -= 1;
    if (gs.contentDebt > 25) rep -= 1;
    if (gs.technicalScore < 35) rep -= 1;
    if (gs.toxicity > 40) rep -= 2;
    gs.reputation = cap(gs.reputation + rep);

    // Recovery tracking (for the Recovery Expert achievement)
    const w = gs.stats.recoveryWatch;
    if (w && gs.organicTraffic >= w.peak * 0.98) { gs.stats.recoveries += 1; gs.stats.recoveryWatch = null; }
    else if (w && gs.month - w.month > 4) gs.stats.recoveryWatch = null;
    if (!gs.stats.recoveryWatch && tp <= -10) gs.stats.recoveryWatch = { peak: before.traffic, month: gs.month };

    const completed = M.evaluate(gs);
    const fresh = AC.check(gs);
    SR.profile.noteAchievements(fresh.map(a => a.id));
    SR.profile.addXp(15 + completed.length * 25);
    completed.forEach(m => E.log(gs, 'success', 'fa-bullseye', 'Mission complete', m.title));
    fresh.forEach(a => E.log(gs, 'success', 'fa-trophy', 'Achievement unlocked', a.name));

    const after = R.snapshot(gs);
    const report = buildMonthlyReport(gs, before, after, completed, rep);
    gs.monthlyHistory.push({
      month: gs.month, snap: after, spent: gs.budgetUsedThisMonth, actions: gs.actionsThisMonth.slice(),
      event: gs.monthLog.event, decision: gs.monthLog.decision,
      missions: gs.missions.map(m => ({ title: m.title, done: m.done, reward: m.reward })), report
    });
    gs.flow = { stage: 'report', report };
  };

  /* Player continues after the monthly report */
  E.afterReport = function (gs) {
    if (gs.month >= CONFIG.TOTAL_MONTHS) return E.endGame(gs);
    E.beginMonth(gs);
  };

  E.beginMonth = function (gs) {
    gs.carryover = gs.budget;
    gs.month += 1;
    gs.budget = R.monthlyBudget(gs);
    gs.bonusNext = 0;
    gs.actionPoints = CONFIG.MAX_AP;
    gs.actionsThisMonth = []; gs.budgetUsedThisMonth = 0;
    gs.keywordResearchDone = false; gs.gscBonus = false;
    gs.monthLog = { event: null, decision: null };
    gs.monthAchievements = [];
    gs.missions = M.generate(gs);
    M.stamp(gs);
    gs.flow = { stage: 'plan' };
    E.log(gs, 'info', 'fa-calendar-plus', `Month ${gs.month} begins`, `Budget refreshed to ${money(gs.budget)}.`);
  };

  E.dismissPlan = function (gs) { gs.flow = { stage: 'play' }; };

  E.endGame = function (gs) {
    gs.phase = 'ended';
    const fresh = AC.check(gs);
    SR.profile.noteAchievements(fresh.map(a => a.id));
    const g = E.grade(gs);
    gs.final = { grade: g.grade, title: g.title };
    SR.profile.recordCampaign(gs, g.grade);
    gs.flow = { stage: 'final' };
  };

  /* ============================================================
     Situation, recommended focus and signals (monthly planning)
     ============================================================ */
  E.signals = function (gs) {
    const s = R.series(gs); const n = s.length; const last = s[n - 1]; const prev = s[n - 2];
    const out = [];
    if (prev) {
      const p = SR.pct(last.traffic, prev.traffic);
      out.push({ tone: p >= 3 ? 'good' : p <= -3 ? 'bad' : 'neutral', text: p >= 3 ? `Traffic grew ${Math.round(p)}% last month.` : p <= -3 ? `Traffic fell ${Math.abs(Math.round(p))}% last month.` : 'Traffic was flat last month.' });
      const t = last.technical - prev.technical;
      if (t <= -2) out.push({ tone: 'bad', text: 'Technical health is slipping.' });
    } else out.push({ tone: 'neutral', text: `You start at ${fmt(gs.organicTraffic)} visitors a month.` });
    const weak = EV.situationHint(gs);
    out.push({ tone: 'warn', text: `Weakest SEO score area: ${weak}.` });
    out.push({ tone: S.pressureTone(gs.pressure), text: `Competitor pressure is ${S.pressureLabel(gs.pressure).toLowerCase()}.` });
    if (gs.toxicity >= 20) out.push({ tone: 'bad', text: 'Your link profile is getting risky.' });
    else if (gs.contentDebt >= 15) out.push({ tone: 'bad', text: 'Thin content is piling up as content debt.' });
    if (gs.demand.monthsLeft > 0) out.push({ tone: gs.demand.mod > 1 ? 'good' : 'warn', text: `${gs.demand.label} is affecting traffic.` });
    return out.slice(0, 5);
  };

  E.situation = function (gs) {
    const s = R.series(gs); const n = s.length; const last = s[n - 1]; const prev = s[n - 2];
    if (!prev) return `Your ${SR.WEBSITE_TYPES[gs.websiteType].short.toLowerCase()} gets about ${fmt(gs.organicTraffic)} organic visitors a month, with ${EV.situationHint(gs).toLowerCase()} as the weakest part of your foundation. Decide where to invest first.`;
    const p = SR.pct(last.traffic, prev.traffic);
    const traffic = p >= 3 ? 'Traffic is growing' : p <= -3 ? 'Traffic is falling' : 'Traffic is flat';
    let second;
    if (last.technical < prev.technical - 1 || gs.technicalScore < 40) second = 'technical health is declining';
    else if (gs.toxicity >= 20) second = 'your link profile is looking risky';
    else if (gs.contentDebt >= 15) second = 'content debt is building up';
    else if (gs.pressure >= 8) second = 'competitors are gaining ground';
    else if (gs.seoHealth < 50) second = 'site health is weak';
    else second = `${EV.situationHint(gs).toLowerCase()} remains your weakest area`;
    const joiner = (p >= 3 && /declin|risky|building|gaining|weak/.test(second)) || (p <= -3 && !/declin|risky|building|gaining|weak/.test(second)) ? 'but' : 'and';
    return `${traffic} ${joiner} ${second}.`;
  };

  E.focus = function (gs) {
    const items = [];
    const T = gs.technicalScore, C = gs.contentScore, L = gs.internalLinking, U = gs.userExperience;
    items.push({ area: 'Technical SEO', cat: 'tech', score: Math.max(0, 72 - T) + (gs.seoHealth < 50 ? 8 : 0) + (T < 45 ? 10 : 0),
      reason: T < 50 ? `Technical SEO is only ${T}/100. Weak foundations limit everything else.` : `Technical health is ${T}/100. Keep it from drifting.` });
    items.push({ area: 'Content', cat: 'content', score: Math.max(0, 68 - C) * 0.95 + (gs.keywordCoverage < 30 ? 6 : 0) + Math.max(0, gs.pressure) * 0.6 + (gs.contentDebt >= 12 ? 5 : 0),
      reason: gs.contentDebt >= 12 ? 'Quality content (and cleaning up thin pages) will rebuild trust.' : C < 45 ? `Content quality is ${C}/100. Better pages unlock more keywords.` : 'Fresh, in-depth content keeps compounding your reach.' });
    const linksBlocked = gs.toxicity >= 20;
    items.push({ area: 'Authority', cat: 'authority', score: Math.max(0, 45 - gs.authority) * 0.85 - (C < 30 ? 12 : 0) + (linksBlocked ? 6 : 0),
      reason: linksBlocked ? 'Toxic links are dragging authority. Earn clean, relevant links to dilute them.' : C < 30 ? 'Authority will help, but links need decent content to earn.' : `Authority is ${gs.authority}. Relevant links lift competitive keywords.` });
    items.push({ area: 'Internal Linking', cat: 'tech', score: Math.max(0, 60 - L) * 0.75 + (gs.rankingKeywords > 60 ? 4 : 0),
      reason: `Internal linking is ${L}/100. Cheap to improve, helps every page.` });
    items.push({ area: 'User Experience', cat: 'ux', score: Math.max(0, 62 - U) * 0.85,
      reason: `User experience is ${U}/100. Faster pages protect rankings and visitors.` });
    items.push({ area: 'AI Search', cat: 'ai', score: C >= 40 ? Math.max(0, 40 - gs.aiVisibility) * 0.4 : 0,
      reason: 'Your content base is ready to be structured for AI-assisted answers.' });
    return items.filter(i => i.score > 1).sort((a, b) => b.score - a.score).slice(0, 3);
  };

  /* ============================================================
     Monthly report (all text generated locally from game logic)
     ============================================================ */
  function buildMonthlyReport(gs, before, after, completed, repDelta) {
    const metrics = [
      { key: 'traffic', label: 'Organic Traffic', before: before.traffic, after: after.traffic },
      { key: 'keywords', label: 'Ranking Keywords', before: before.keywords, after: after.keywords },
      { key: 'top10', label: 'Top 10 Keywords', before: before.top10, after: after.top10 },
      { key: 'seoScore', label: 'SEO Score', before: before.seoScore, after: after.seoScore },
      { key: 'authority', label: 'Authority', before: before.authority, after: after.authority },
      { key: 'aiVis', label: 'AI Visibility', before: before.aiVis, after: after.aiVis },
      { key: 'revenue', label: 'Revenue', before: before.revenue, after: after.revenue, money: true }
    ];

    const wins = [], hurts = [], risks = [];
    gs.actionsThisMonth.forEach(a => {
      if (a.impact >= 1.5) wins.push({ s: a.impact, t: `${a.shortName}: ${a.summary}` });
      else if (a.impact < 0) hurts.push({ s: -a.impact, t: `${a.shortName} backfired: ${a.summary}` });
    });
    const tp = SR.pct(after.traffic, before.traffic);
    if (tp >= 5) wins.push({ s: tp / 2, t: `Organic traffic grew ${Math.round(tp)}% as your rankings improved.` });
    if (tp <= -3) hurts.push({ s: Math.abs(tp) / 2, t: `Organic traffic fell ${Math.abs(Math.round(tp))}%.` });
    if (after.top10 > before.top10) wins.push({ s: (after.top10 - before.top10), t: `${after.top10 - before.top10} more keywords reached page one.` });
    if (after.top10 < before.top10) hurts.push({ s: before.top10 - after.top10, t: `${before.top10 - after.top10} keywords fell off page one.` });
    const ev = gs.monthLog.event;
    if (ev) (ev.tone === 'good' ? wins : hurts).push({ s: 6, t: `Event: ${ev.name}.` });
    const dc = gs.monthLog.decision;
    if (dc) ((dc.impact >= 0 && dc.tone !== 'bad') ? wins : hurts).push({ s: Math.abs(dc.impact) + 2, t: `Decision: ${dc.choice}. ${dc.summary}` });
    completed.forEach(m => wins.push({ s: 4, t: `Mission complete: ${m.title} (+${money(m.reward.budget)}, +${m.reward.rep} reputation).` }));
    const d = gs.monthDecay || {};
    const decayBits = [];
    if (d.content) decayBits.push(`content freshness −${d.content}`);
    if (d.technical) decayBits.push(`technical −${d.technical}`);
    if (d.ux) decayBits.push(`user experience −${d.ux}`);
    if (decayBits.length) hurts.push({ s: 1, t: `Natural decay: ${decayBits.join(', ')}. Sites need ongoing maintenance.` });
    if (after.pressure - before.pressure >= 2) hurts.push({ s: after.pressure - before.pressure, t: `Competitors strengthened. ${(gs.competitorNews[0] || {}).text || ''}` });
    if (gs.actionPoints > 0) hurts.push({ s: 0.5, t: `You left ${gs.actionPoints} action point${gs.actionPoints > 1 ? 's' : ''} unused.` });
    if (after.reputation < before.reputation) hurts.push({ s: before.reputation - after.reputation, t: `Reputation slipped ${before.reputation - after.reputation} points.` });

    const byScore = (a, b) => b.s - a.s;
    wins.sort(byScore); hurts.sort(byScore);

    if (gs.toxicity >= 20) risks.push({ s: gs.toxicity / 2.5, t: `Link toxicity is ${gs.toxicity}. A penalty becomes likelier the longer it stays high.` });
    if (gs.contentDebt >= 12) risks.push({ s: gs.contentDebt / 2, t: `Content debt is ${gs.contentDebt}. Thin pages could trigger a cleanup that costs traffic.` });
    if (gs.technicalScore < 50) risks.push({ s: (55 - gs.technicalScore), t: `Technical SEO is ${gs.technicalScore}/100, which makes technical incidents more likely.` });
    if (gs.pressure >= 8) risks.push({ s: gs.pressure * 1.3, t: `Competitor pressure is ${S.pressureLabel(gs.pressure).toLowerCase()}. Rivals are pulling ahead.` });
    if (gs.userExperience < 40) risks.push({ s: 45 - gs.userExperience, t: `User experience is ${gs.userExperience}/100. Visitors and rankings are both at risk.` });
    if (gs.seoHealth < 45) risks.push({ s: 50 - gs.seoHealth, t: `SEO Health is only ${gs.seoHealth}.` });
    risks.sort(byScore);

    const focus = E.focus(gs)[0];
    const biggestWin = wins[0] ? wins[0].t : 'A quiet month. You held your ground without any standout wins.';
    const biggestRisk = risks[0] ? risks[0].t : 'No major risks right now. Keep maintaining your foundations.';
    const nextOpportunity = focus ? `${focus.area}: ${focus.reason}` : 'Your fundamentals look balanced. Look for growth in new keywords and authority.';

    // Local "AI-style" explanation
    const posMove = before.position - after.position;
    const topAction = gs.actionsThisMonth.slice().sort((a, b) => b.impact - a.impact)[0];
    let explanation = `Organic traffic ${tp >= 1 ? 'rose' : tp <= -1 ? 'fell' : 'held steady'} ${Math.abs(Math.round(tp))}% to ${fmt(after.traffic)}, as your average keyword position ${posMove > 0 ? `improved from #${before.position} to #${after.position}` : posMove < 0 ? `slipped from #${before.position} to #${after.position}` : `stayed around #${after.position}`}. `;
    if (topAction && topAction.impact > 0) explanation += `${topAction.shortName} was your strongest move this month. `;
    else if (!gs.actionsThisMonth.length) explanation += 'With no actions taken, the site coasted on earlier momentum while natural decay set in. ';
    explanation += risks[0] ? `Keep an eye on this: ${risks[0].t.charAt(0).toLowerCase()}${risks[0].t.slice(1)}` : `Next, consider ${focus ? focus.area.toLowerCase() : 'new keyword opportunities'}.`;

    return {
      month: gs.month, metrics, worked: wins.slice(0, 4).map(x => x.t), hurt: hurts.slice(0, 4).map(x => x.t),
      biggestWin, biggestRisk, nextOpportunity, explanation,
      missions: gs.missions.map(m => ({ title: m.title, done: m.done, reward: m.reward })),
      achievements: gs.monthAchievements.slice(), repDelta, news: gs.competitorNews.slice(0, 2).map(n => n.text)
    };
  }

  /* ============================================================
     Simulated GSC data (clearly labelled in the UI)
     ============================================================ */
  E.gscData = function (gs) {
    const clicks = Math.round(gs.organicTraffic * rand(0.95, 1.05));
    const ctrRaw = pos => clamp(0.0015 + 0.30 * Math.exp(-0.18 * (pos - 1)), 0.001, 0.3);
    const ctr = clamp((0.012 + ((100 - gs.avgPosition) / 100) * 0.06) * rand(0.9, 1.1), 0.008, 0.09);
    const impressions = Math.round(clicks / ctr);
    const weights = gs.keywords.map(k => ({ k, w: k.volume * R.visibility(k.position) }));
    const totalW = weights.reduce((a, x) => a + x.w, 0) || 1;
    const queries = weights.slice().sort((a, b) => b.w - a.w).slice(0, 5).map(({ k, w }) => {
      const c = Math.max(1, Math.round(clicks * (w / totalW) * 0.6));
      return { term: k.term, clicks: c, impressions: Math.max(c, Math.round(c / ctrRaw(k.position))), position: k.position };
    });
    const moved = gs.keywords.map(k => ({ k, d: Math.round(k.volume * (R.visibility(k.position) - R.visibility(k.prev)) * gs.trafficCal) }));
    const gaining = moved.filter(x => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 3).map(x => ({ page: slug(x.k.term), delta: x.d, term: x.k.term }));
    const losing = moved.filter(x => x.d < 0).sort((a, b) => a.d - b.d).slice(0, 3).map(x => ({ page: slug(x.k.term), delta: x.d, term: x.k.term }));

    const alerts = [];
    const T = gs.technicalScore;
    if (T < 40) alerts.push({ sev: 'high', text: `${Math.max(3, Math.round((100 - T) / 6))} pages are "Crawled, currently not indexed".` });
    if (T < 70) alerts.push({ sev: 'med', text: `${Math.max(2, Math.round((100 - T) / 12))} pages have duplicate content without a canonical.` });
    if (gs.contentDebt >= 10) alerts.push({ sev: 'med', text: `${Math.round(gs.contentDebt / 2.5)} thin pages are "Discovered, currently not indexed".` });
    if (gs.userExperience < 45) alerts.push({ sev: 'med', text: `${Math.round((100 - gs.userExperience) / 5)} mobile URLs need Core Web Vitals improvement.` });
    if (gs.internalLinking < 30) alerts.push({ sev: 'low', text: `${Math.round((60 - gs.internalLinking) / 4)} orphan pages have no internal links.` });
    if (!alerts.length) alerts.push({ sev: 'ok', text: 'No critical indexing issues detected.' });

    const focus = E.focus(gs)[0];
    return { clicks, impressions, ctr, avgPosition: gs.avgPosition, queries, gaining, losing, alerts, tip: focus ? `${focus.area}: ${focus.reason}` : 'Fundamentals look balanced. Keep expanding coverage.' };
  };

  /* ============================================================
     Final report, grade and share text
     ============================================================ */
  E.grade = function (gs) {
    const ratio = gs.organicTraffic / Math.max(1, gs.start.traffic);
    const composite =
      35 * clamp(Math.log(Math.max(1, ratio)) / Math.log(30), 0, 1) +
      30 * (gs.seoScore / 100) + 10 * (gs.reputation / 100) +
      15 * (Object.keys(gs.achievements).length / AC.LIST.length) +
      10 * clamp(gs.top10Keywords / 25, 0, 1);
    const g = composite >= 80 ? ['S', 'SEO Master'] : composite >= 66 ? ['A', 'Senior SEO Strategist'] :
      composite >= 52 ? ['B', 'SEO Specialist'] : composite >= 38 ? ['C', 'SEO Executive'] :
      composite >= 24 ? ['D', 'SEO Beginner'] : ['F', 'SEO Trainee'];
    return { grade: g[0], title: g[1], composite: Math.round(composite) };
  };

  E.finalReport = function (gs) {
    const s = gs.start;
    const rows = [
      { label: 'Organic Traffic', before: s.traffic, after: gs.organicTraffic },
      { label: 'Ranking Keywords', before: s.keywords, after: gs.rankingKeywords },
      { label: 'Top 10 Keywords', before: s.top10, after: gs.top10Keywords },
      { label: 'SEO Score', before: s.seoScore, after: gs.seoScore, of100: true },
      { label: 'Authority', before: s.authority, after: gs.authority, of100: true },
      { label: 'AI Visibility', before: s.aiVis, after: gs.aiVisibility, of100: true },
      { label: 'Monthly Revenue', before: s.revenue, after: gs.monthlyRevenue, money: true }
    ].map(r => ({ ...r, growth: r.before > 0 ? Math.round(SR.pct(r.after, r.before)) : null }));

    const g = E.grade(gs);
    const ledger = gs.ledger.slice();
    const best = ledger.filter(l => l.impact > 0.5).sort((a, b) => b.impact - a.impact).slice(0, 5);
    const mistakes = ledger.filter(l => l.impact < -0.5).sort((a, b) => a.impact - b.impact).slice(0, 3)
      .map(l => ({ title: l.title, detail: l.detail, month: l.month }));
    const synthetic = [];
    if (gs.contentCounts.poor >= 1) synthetic.push({ title: `Published ${gs.contentCounts.poor} Poor-quality content piece${gs.contentCounts.poor > 1 ? 's' : ''}`, detail: 'Thin content builds content debt and weakens trust.', month: null });
    if (gs.stats.unusedAP >= 3) synthetic.push({ title: `Left ${gs.stats.unusedAP} action points unused`, detail: 'Idle months let competitors and natural decay catch up.', month: null });
    if (gs.stats.techNeglectMonths >= 2) synthetic.push({ title: 'Let technical health stay below 40', detail: `It stayed weak for ${gs.stats.techNeglectMonths} months at the end, making incidents likelier.`, month: null });
    if (gs.toxicity >= 20) synthetic.push({ title: 'Ended with a risky link profile', detail: `Link toxicity finished at ${gs.toxicity}.`, month: null });
    synthetic.forEach(x => { if (mistakes.length < 3) mistakes.push(x); });

    const series = R.series(gs);
    let bestM = null, worstM = null;
    for (let i = 1; i < series.length; i++) {
      const p = SR.pct(series[i].traffic, series[i - 1].traffic);
      if (!bestM || p > bestM.p) bestM = { month: series[i].month, p, traffic: series[i].traffic };
      if (!worstM || p < worstM.p) worstM = { month: series[i].month, p };
    }
    const hist = gs.monthlyHistory.find(h => worstM && h.month === worstM.month);
    const evName = hist && hist.event && hist.event.tone !== 'good' ? hist.event.name : null;
    const challenge = worstM && worstM.p < -2
      ? `Month ${worstM.month}: traffic fell ${Math.abs(Math.round(worstM.p))}%${evName ? ` after "${evName}"` : ''}. ${gs.stats.recoveries ? 'You recovered.' : 'It took time to rebuild.'}`
      : 'Traffic never took a serious hit. Your biggest challenge was steady competitor growth.';

    return {
      rows, grade: g.grade, title: g.title, composite: g.composite, totalRevenue: gs.totalRevenue,
      best, mistakes,
      biggestGrowth: bestM ? `Month ${bestM.month}: traffic ${bestM.p >= 0 ? 'rose' : 'moved'} ${Math.round(bestM.p)}% to ${fmt(bestM.traffic)}.` : 'n/a',
      challenge, summary: strategySummary(gs),
      achievements: Object.keys(gs.achievements)
    };
  };

  function strategySummary(gs) {
    const c = gs.actionCounts; const g = id => c[id] || 0;
    const groups = {
      Technical: g('technicalSEO') + g('pageExperience') + g('internalLinking'),
      Content: g('keywordResearch') + g('publishContent'),
      Authority: g('buildBacklinks') + g('localSEO'),
      'AI search': g('aeoOptimization') + g('geoOptimization'),
      Analysis: g('analyzeGSC')
    };
    const total = Object.values(groups).reduce((a, b) => a + b, 0) || 1;
    const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
    let t = `Across ${total} actions, you led with ${sorted[0][0].toLowerCase()} work (${sorted[0][1]})`;
    if (sorted[1][1] > 0) t += `, backed by ${sorted[1][0].toLowerCase()} (${sorted[1][1]})`;
    t += '. ';
    if (gs.toxicity < 10 && gs.contentDebt < 10) t += 'Your link profile and content stayed clean, which is the mark of a sustainable strategy. ';
    else if (gs.toxicity >= 20 || gs.contentDebt >= 15) t += 'Shortcuts left some link or content debt behind, which would need cleaning up if the campaign continued. ';
    if (groups.Technical === 0) t += 'You never invested in technical foundations. That is a risky gap. ';
    t += gs.pressure <= 0 ? 'You finished ahead of your competitors.' : 'Competitors were still ahead at the finish, so there is room to grow.';
    return t;
  }

  E.shareText = function (gs) {
    const g = E.grade(gs);
    const s = gs.start;
    return [
      'SEO RANKER RESULT', '', '12-Month Campaign', `${gs.websiteName} · ${SR.DIFFICULTIES[gs.difficulty].name}`, '',
      'Traffic:', `${fmt(s.traffic)} → ${fmt(gs.organicTraffic)}`, '',
      'Ranking Keywords:', `${fmt(s.keywords)} → ${fmt(gs.rankingKeywords)}`, '',
      'SEO Score:', `${gs.seoScore}/100`, '',
      'Authority:', `${gs.authority}`, '',
      'AI Visibility (simulated):', `${gs.aiVisibility}`, '',
      'Final Rank:', `${g.title.toUpperCase()} (Grade ${g.grade})`, '',
      '"I survived 12 months of SEO. Can you beat my score?"'
    ].join('\n');
  };

  E.SLUG = slug;
})();
